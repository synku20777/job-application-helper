import Dexie, { type Table } from "dexie";
import type { CandidateProfile } from "@job-helper/profile-schema";
import type { EncryptionStatus, ProfileSummary, ProfileVariant, ProfileVariantSummary, SavedFieldOverride, SiteMappingOverride } from "@job-helper/shared";
import {
  decryptProfileWithKey,
  encryptProfileWithKey,
  importPassphraseKey,
  type EncryptedProfilePayload
} from "./profileCrypto";
import { clearFirstRunConsent } from "./complianceStore";
import { validateVariantOverrides } from "./profileVariants";

type StoredProfile = {
  profileId: string;
  label: string;
  updatedAt: string;
  profile: CandidateProfile;
};

export type EncryptedProfileRecord = {
  profileId: string;
  label: string;
  updatedAt: string;
  encrypted: EncryptedProfilePayload;
};

class JobAutofillDb extends Dexie {
  profiles!: Table<StoredProfile, string>;
  siteOverrides!: Table<SiteMappingOverride, string>;
  encryptedProfiles!: Table<EncryptedProfileRecord, string>;
  profileVariants!: Table<ProfileVariant, string>;

  constructor() {
    super("job-autofill-extension");
    this.version(1).stores({
      profiles: "profileId, label, updatedAt"
    });
    this.version(2).stores({
      profiles: "profileId, label, updatedAt",
      siteOverrides: "id, hostname, adapterId, updatedAt"
    });
    this.version(3).stores({
      profiles: "profileId, label, updatedAt",
      siteOverrides: "id, hostname, adapterId, updatedAt",
      encryptedProfiles: "profileId, label, updatedAt"
    });
    this.version(4).stores({
      profiles: "profileId, label, updatedAt",
      siteOverrides: "id, hostname, adapterId, updatedAt",
      encryptedProfiles: "profileId, label, updatedAt",
      profileVariants: "variantId, baseProfileId, updatedAt"
    });
  }
}

const db = new JobAutofillDb();
let unlockedPassphraseKey: CryptoKey | null = null;
const decryptedProfileCache = new Map<string, CandidateProfile>();

function overrideStoreId(hostname: string, adapterId: string): string {
  return `${adapterId}:${hostname.toLowerCase()}`;
}

function fieldOverrideId(): string {
  return crypto.randomUUID?.() ?? `override-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sameOverrideTarget(saved: SavedFieldOverride, next: Omit<SavedFieldOverride, "id" | "createdAt" | "updatedAt">): boolean {
  if (saved.elementSelector && next.elementSelector && saved.elementSelector === next.elementSelector) return true;
  if (!saved.label || !next.label) return false;
  return saved.label.trim().toLowerCase() === next.label.trim().toLowerCase();
}

async function selectedProfileId(): Promise<string | undefined> {
  const { selectedProfileId: selected } = await chrome.storage.local.get("selectedProfileId");
  return typeof selected === "string" ? selected : undefined;
}

function selectedVariantStorageKey(baseProfileId: string): string {
  return `selectedProfileVariant:${baseProfileId}`;
}

async function selectedVariantId(baseProfileId: string): Promise<string | undefined> {
  const key = selectedVariantStorageKey(baseProfileId);
  const values = await chrome.storage.local.get(key);
  return typeof values[key] === "string" ? values[key] : undefined;
}

async function clearSelectedVariant(baseProfileId: string): Promise<void> {
  await chrome.storage.local.remove(selectedVariantStorageKey(baseProfileId));
}

async function selectedEncryptedRecord(): Promise<EncryptedProfileRecord | undefined> {
  const selected = await selectedProfileId();
  if (selected) {
    const selectedRecord = await db.encryptedProfiles.get(selected);
    if (selectedRecord) return selectedRecord;
  }
  return db.encryptedProfiles.orderBy("updatedAt").last();
}

async function decryptRecord(record: EncryptedProfileRecord): Promise<CandidateProfile> {
  if (!unlockedPassphraseKey) throw new Error("Profile store is locked. Unlock profiles first.");
  const cached = decryptedProfileCache.get(record.profileId);
  if (cached) return cached;
  const profile = await decryptProfileWithKey(record.encrypted, unlockedPassphraseKey);
  decryptedProfileCache.set(record.profileId, profile);
  return profile;
}

export function isProfileStoreUnlocked(): boolean {
  return Boolean(unlockedPassphraseKey);
}

export async function getEncryptionStatus(): Promise<EncryptionStatus> {
  const [encryptedProfileCount, legacyProfileCount, selected] = await Promise.all([
    db.encryptedProfiles.count(),
    db.profiles.count(),
    selectedProfileId()
  ]);
  const { profileEncryptionConfigured } = await chrome.storage.local.get("profileEncryptionConfigured");
  const selectedEncrypted = selected ? await db.encryptedProfiles.get(selected) : undefined;
  const selectedLegacy = selected ? await db.profiles.get(selected) : undefined;

  return {
    configured: profileEncryptionConfigured === true || encryptedProfileCount > 0,
    unlocked: isProfileStoreUnlocked(),
    hasLegacyProfiles: legacyProfileCount > 0,
    encryptedProfileCount,
    legacyProfileCount,
    selectedProfileId: selected,
    selectedProfileLabel: selectedEncrypted?.label ?? selectedLegacy?.label
  };
}

export async function listProfiles(): Promise<ProfileSummary[]> {
  const selected = await selectedProfileId();
  const [encryptedProfiles, legacyProfiles] = await Promise.all([db.encryptedProfiles.toArray(), db.profiles.toArray()]);
  const summariesWithoutSelection = [
    ...encryptedProfiles.map((record) => ({
      profileId: record.profileId,
      label: record.label,
      updatedAt: record.updatedAt,
      selected: false
    })),
    ...legacyProfiles
      .filter((legacy) => !encryptedProfiles.some((record) => record.profileId === legacy.profileId))
      .map((record) => ({
        profileId: record.profileId,
        label: record.label,
        updatedAt: record.updatedAt,
        selected: false
      }))
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const selectedExists = summariesWithoutSelection.some((summary) => summary.profileId === selected);
  const selectedForDisplay = selectedExists ? selected : summariesWithoutSelection[0]?.profileId;
  return summariesWithoutSelection.map((summary) => ({ ...summary, selected: summary.profileId === selectedForDisplay }));
}

export async function selectProfile(profileId: string): Promise<{ profiles: ProfileSummary[]; profile: CandidateProfile | null }> {
  const [encryptedRecord, legacyRecord] = await Promise.all([db.encryptedProfiles.get(profileId), db.profiles.get(profileId)]);
  if (!encryptedRecord && !legacyRecord) throw new Error("Profile not found.");
  await chrome.storage.local.set({ selectedProfileId: profileId });
  return { profiles: await listProfiles(), profile: await getSelectedProfile() };
}

export async function listProfileVariants(
  baseProfileId: string
): Promise<{ variants: ProfileVariantSummary[]; selectedVariantId?: string; selectedVariant?: ProfileVariant | null }> {
  const selected = await selectedVariantId(baseProfileId);
  const variants = (await db.profileVariants.where("baseProfileId").equals(baseProfileId).toArray()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  const selectedExists = variants.some((variant) => variant.variantId === selected);
  const selectedForDisplay = selectedExists ? selected : undefined;

  return {
    selectedVariantId: selectedForDisplay,
    selectedVariant: selectedForDisplay ? (await db.profileVariants.get(selectedForDisplay)) ?? null : null,
    variants: variants.map((variant) => ({
      variantId: variant.variantId,
      baseProfileId: variant.baseProfileId,
      label: variant.label,
      targetRole: variant.targetRole,
      updatedAt: variant.updatedAt,
      selected: variant.variantId === selectedForDisplay
    }))
  };
}

export async function selectedProfileVariant(baseProfileId: string): Promise<ProfileVariant | null> {
  const selected = await selectedVariantId(baseProfileId);
  return selected ? (await db.profileVariants.get(selected)) ?? null : null;
}

export async function saveProfileVariant(
  variant: Omit<ProfileVariant, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }
): Promise<{ variants: ProfileVariantSummary[]; selectedVariantId?: string; selectedVariant?: ProfileVariant | null }> {
  const [encryptedRecord, legacyRecord] = await Promise.all([
    db.encryptedProfiles.get(variant.baseProfileId),
    db.profiles.get(variant.baseProfileId)
  ]);
  if (!encryptedRecord && !legacyRecord) throw new Error("Base profile not found.");

  const now = new Date().toISOString();
  const existing = await db.profileVariants.get(variant.variantId);
  const next: ProfileVariant = {
    variantId: variant.variantId,
    baseProfileId: variant.baseProfileId,
    label: variant.label.trim(),
    targetRole: variant.targetRole?.trim() || undefined,
    overrides: validateVariantOverrides(variant.overrides),
    createdAt: existing?.createdAt ?? variant.createdAt ?? now,
    updatedAt: now
  };

  if (!next.variantId.trim()) throw new Error("Variant id is required.");
  if (!next.label) throw new Error("Variant label is required.");

  await db.profileVariants.put(next);
  await chrome.storage.local.set({ [selectedVariantStorageKey(next.baseProfileId)]: next.variantId });
  return listProfileVariants(next.baseProfileId);
}

export async function selectProfileVariant(
  baseProfileId: string,
  variantId: string | null
): Promise<{ variants: ProfileVariantSummary[]; selectedVariantId?: string; selectedVariant?: ProfileVariant | null }> {
  if (variantId === null) {
    await clearSelectedVariant(baseProfileId);
    return listProfileVariants(baseProfileId);
  }

  const variant = await db.profileVariants.get(variantId);
  if (!variant || variant.baseProfileId !== baseProfileId) throw new Error("Role variant not found.");
  await chrome.storage.local.set({ [selectedVariantStorageKey(baseProfileId)]: variantId });
  return listProfileVariants(baseProfileId);
}

export async function deleteProfileVariant(
  baseProfileId: string,
  variantId: string
): Promise<{ variants: ProfileVariantSummary[]; selectedVariantId?: string; selectedVariant?: ProfileVariant | null }> {
  await db.profileVariants.delete(variantId);
  if ((await selectedVariantId(baseProfileId)) === variantId) await clearSelectedVariant(baseProfileId);
  return listProfileVariants(baseProfileId);
}

export async function setProfilePassphrase(passphrase: string): Promise<{ status: EncryptionStatus; profile: CandidateProfile | null }> {
  const [status, legacyProfiles] = await Promise.all([getEncryptionStatus(), db.profiles.toArray()]);
  if (status.configured && legacyProfiles.length === 0) {
    throw new Error("Profile encryption is already configured. Unlock profiles with the existing passphrase.");
  }

  unlockedPassphraseKey = await importPassphraseKey(passphrase);
  decryptedProfileCache.clear();

  for (const legacy of legacyProfiles) {
    await db.encryptedProfiles.put({
      profileId: legacy.profileId,
      label: legacy.label,
      updatedAt: legacy.updatedAt,
      encrypted: await encryptProfileWithKey(legacy.profile, unlockedPassphraseKey)
    });
    decryptedProfileCache.set(legacy.profileId, legacy.profile);
  }

  if (legacyProfiles.length > 0) await db.profiles.clear();
  const selectedBeforeMigration = await selectedProfileId();
  const migratedSelected = selectedBeforeMigration
    ? await db.encryptedProfiles.get(selectedBeforeMigration)
    : await db.encryptedProfiles.orderBy("updatedAt").last();
  const selected = migratedSelected?.profileId;
  await chrome.storage.local.set({ profileEncryptionConfigured: true, ...(selected ? { selectedProfileId: selected } : {}) });

  return { status: await getEncryptionStatus(), profile: await getSelectedProfile() };
}

export async function unlockProfileStore(passphrase: string): Promise<{ status: EncryptionStatus; profile: CandidateProfile | null }> {
  unlockedPassphraseKey = await importPassphraseKey(passphrase);
  decryptedProfileCache.clear();

  const record = await selectedEncryptedRecord();
  if (record) await decryptRecord(record);

  return { status: await getEncryptionStatus(), profile: await getSelectedProfile() };
}

export async function lockProfileStore(): Promise<EncryptionStatus> {
  unlockedPassphraseKey = null;
  decryptedProfileCache.clear();
  return getEncryptionStatus();
}

export async function saveProfile(profile: CandidateProfile): Promise<CandidateProfile> {
  if (!unlockedPassphraseKey) throw new Error("Profile store is locked. Unlock profiles before saving.");

  await db.encryptedProfiles.put({
    profileId: profile.meta.profileId,
    label: profile.meta.label,
    updatedAt: profile.meta.updatedAt,
    encrypted: await encryptProfileWithKey(profile, unlockedPassphraseKey)
  });
  decryptedProfileCache.set(profile.meta.profileId, profile);
  await chrome.storage.local.set({ selectedProfileId: profile.meta.profileId, profileEncryptionConfigured: true });
  return profile;
}

export async function deleteProfile(profileId: string): Promise<{ profiles: ProfileSummary[]; profile: CandidateProfile | null }> {
  await Promise.all([db.encryptedProfiles.delete(profileId), db.profiles.delete(profileId)]);
  const variants = await db.profileVariants.where("baseProfileId").equals(profileId).toArray();
  await Promise.all(variants.map((variant) => db.profileVariants.delete(variant.variantId)));
  await clearSelectedVariant(profileId);
  decryptedProfileCache.delete(profileId);

  const selected = await selectedProfileId();
  if (selected === profileId) {
    const next = await db.encryptedProfiles.orderBy("updatedAt").last();
    if (next) await chrome.storage.local.set({ selectedProfileId: next.profileId });
    else await chrome.storage.local.remove("selectedProfileId");
  }

  return { profiles: await listProfiles(), profile: await getSelectedProfile() };
}

export async function getSelectedProfile(): Promise<CandidateProfile | null> {
  const record = await selectedEncryptedRecord();
  if (!record) return null;
  if (!unlockedPassphraseKey) return null;
  return decryptRecord(record);
}

export async function exportSelectedProfile(): Promise<CandidateProfile | null> {
  if (!unlockedPassphraseKey) throw new Error("Profile store is locked. Unlock profiles before exporting.");
  return getSelectedProfile();
}

export async function getSiteOverride(hostname: string, adapterId: string): Promise<SiteMappingOverride | null> {
  return (await db.siteOverrides.get(overrideStoreId(hostname, adapterId))) ?? null;
}

export async function saveSiteOverride(
  hostname: string,
  adapterId: string,
  override: Omit<SavedFieldOverride, "id" | "createdAt" | "updatedAt">
): Promise<SiteMappingOverride> {
  const now = new Date().toISOString();
  const id = overrideStoreId(hostname, adapterId);
  const existing = await db.siteOverrides.get(id);
  const fields = existing?.fields ?? [];
  const existingIndex = fields.findIndex((field) => sameOverrideTarget(field, override));

  const nextField: SavedFieldOverride =
    existingIndex >= 0
      ? { ...fields[existingIndex], ...override, updatedAt: now }
      : { ...override, id: fieldOverrideId(), createdAt: now, updatedAt: now };

  const next: SiteMappingOverride = {
    id,
    hostname: hostname.toLowerCase(),
    adapterId,
    fields: existingIndex >= 0 ? fields.map((field, index) => (index === existingIndex ? nextField : field)) : [...fields, nextField],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  await db.siteOverrides.put(next);
  return next;
}

export async function deleteSiteOverride(hostname: string, adapterId: string, overrideId: string): Promise<SiteMappingOverride | null> {
  const id = overrideStoreId(hostname, adapterId);
  const existing = await db.siteOverrides.get(id);
  if (!existing) return null;

  const nextFields = existing.fields.filter((field) => field.id !== overrideId);
  if (nextFields.length === 0) {
    await db.siteOverrides.delete(id);
    return null;
  }

  const next = { ...existing, fields: nextFields, updatedAt: new Date().toISOString() };
  await db.siteOverrides.put(next);
  return next;
}

export async function deleteAllData(): Promise<void> {
  const variantProfileIds = Array.from(new Set((await db.profileVariants.toArray()).map((variant) => variant.baseProfileId)));
  await Promise.all([db.profiles.clear(), db.encryptedProfiles.clear(), db.siteOverrides.clear(), db.profileVariants.clear()]);
  unlockedPassphraseKey = null;
  decryptedProfileCache.clear();
  await chrome.storage.local.remove(["selectedProfileId", "profileEncryptionConfigured"]);
  await Promise.all(variantProfileIds.map(clearSelectedVariant));
  await clearFirstRunConsent();
}
