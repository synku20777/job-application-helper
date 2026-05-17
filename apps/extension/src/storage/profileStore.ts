import Dexie, { type Table } from "dexie";
import type { CandidateProfile } from "@job-helper/profile-schema";
import type { SavedFieldOverride, SiteMappingOverride } from "@job-helper/shared";

type StoredProfile = {
  profileId: string;
  label: string;
  updatedAt: string;
  profile: CandidateProfile;
};

class JobAutofillDb extends Dexie {
  profiles!: Table<StoredProfile, string>;
  siteOverrides!: Table<SiteMappingOverride, string>;

  constructor() {
    super("job-autofill-extension");
    this.version(1).stores({
      profiles: "profileId, label, updatedAt"
    });
    this.version(2).stores({
      profiles: "profileId, label, updatedAt",
      siteOverrides: "id, hostname, adapterId, updatedAt"
    });
  }
}

const db = new JobAutofillDb();

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

export async function saveProfile(profile: CandidateProfile): Promise<CandidateProfile> {
  await db.profiles.put({
    profileId: profile.meta.profileId,
    label: profile.meta.label,
    updatedAt: profile.meta.updatedAt,
    profile
  });
  await chrome.storage.local.set({ selectedProfileId: profile.meta.profileId });
  return profile;
}

export async function getSelectedProfile(): Promise<CandidateProfile | null> {
  const { selectedProfileId } = await chrome.storage.local.get("selectedProfileId");
  const selected = typeof selectedProfileId === "string" ? selectedProfileId : undefined;
  const row = selected ? await db.profiles.get(selected) : await db.profiles.orderBy("updatedAt").last();
  return row?.profile ?? null;
}

export async function exportSelectedProfile(): Promise<CandidateProfile | null> {
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
  await db.profiles.clear();
  await db.siteOverrides.clear();
  await chrome.storage.local.remove(["selectedProfileId"]);
}
