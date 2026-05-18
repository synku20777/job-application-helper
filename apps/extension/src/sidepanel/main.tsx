import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createLocalMappingOverride, isSensitiveField, stepFromMatch } from "@job-helper/autofill-core";
import { sampleProfile, safeParseCandidateProfile, type CandidateProfile } from "@job-helper/profile-schema";
import type {
  ActiveTabComplianceStatus,
  CanonicalFieldKey,
  EncryptionStatus,
  ExecutionMode,
  ExtensionResponse,
  FillPlan,
  FillStep,
  FirstRunConsentStatus,
  InspectionResult,
  LocalMappingOverride,
  SerializableFieldCandidate,
  PlatformDetection,
  ProfileVariant,
  ProfileVariantSummary,
  ProfileSummary,
  SiteRecipe,
  SiteMappingOverride
} from "@job-helper/shared";
import { CANONICAL_FIELD_KEYS } from "@job-helper/shared";
import { buildProfileSnippets } from "../linkedin/snippets";
import {
  deleteProfileDocument,
  describeDocumentReference,
  documentsByType,
  upsertProfileDocument,
  type CandidateDocument
} from "../profile/documents";
import { applyProfileVariant, validateVariantOverrides } from "../storage/profileVariants";
import "../ui.css";

type ScanState = {
  fields: SerializableFieldCandidate[];
  platform: PlatformDetection;
  url: string;
};

async function send(message: unknown): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(message);
}

function selectedAutoSteps(plan: FillPlan | null): string[] {
  return (
    plan?.steps
      .filter((step) => step.type !== "manual" && step.type !== "uploadFile" && !step.requiresReview)
      .map((step) => step.target.candidateId) ?? []
  );
}

function modeLabel(mode: ExecutionMode): string {
  if (mode === "assisted") return "Assisted";
  if (mode === "recorder") return "Recorder";
  return "Conservative";
}

function hostnameFromUrl(url: string | undefined): string {
  try {
    return new URL(url ?? "about:blank").hostname.toLowerCase();
  } catch {
    return "";
  }
}

function stepCanonicalKey(step: FillStep): CanonicalFieldKey | undefined {
  return "canonicalKey" in step ? step.canonicalKey : undefined;
}

function stepStatus(step: FillStep): string {
  if (step.type === "uploadFile") return "upload";
  if (step.type === "manual") return "manual";
  if (step.requiresReview) return "review";
  return "auto";
}

function valuePreview(step: FillStep, profile: CandidateProfile | null): string {
  if (step.type === "setText" || step.type === "selectOption") return step.value;
  if (step.type === "clickCheckbox") return step.checked ? "Yes" : "No";
  if (step.type === "uploadFile") return describeDocumentReference(profile, step.documentId);
  return step.reason;
}

function canFill(step: FillStep): boolean {
  return step.type !== "manual" && step.type !== "uploadFile";
}

function variantId(): string {
  return `variant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function defaultDocumentForm(): CandidateDocument {
  return {
    id: "",
    type: "resume",
    label: "",
    fileName: "",
    mimeType: "application/pdf",
    description: "",
    targetRole: "",
    tags: []
  };
}

function App() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [profileJson, setProfileJson] = useState(JSON.stringify(sampleProfile, null, 2));
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus | null>(null);
  const [profileSummaries, setProfileSummaries] = useState<ProfileSummary[]>([]);
  const [variantSummaries, setVariantSummaries] = useState<ProfileVariantSummary[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProfileVariant | null>(null);
  const [variantLabel, setVariantLabel] = useState("");
  const [variantRole, setVariantRole] = useState("");
  const [variantJson, setVariantJson] = useState(
    JSON.stringify(
      {
        skills: ["TypeScript", "React"],
        remotePreference: "hybrid"
      },
      null,
      2
    )
  );
  const [documentForm, setDocumentForm] = useState<CandidateDocument>(defaultDocumentForm());
  const [passphrase, setPassphrase] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [consent, setConsent] = useState<FirstRunConsentStatus | null>(null);
  const [activeTabStatus, setActiveTabStatus] = useState<ActiveTabComplianceStatus | null>(null);
  const [executionMode, setExecutionModeState] = useState<ExecutionMode>("conservative");
  const [scan, setScan] = useState<ScanState | null>(null);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [plan, setPlan] = useState<FillPlan | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, CanonicalFieldKey>>({});
  const [siteOverride, setSiteOverride] = useState<SiteMappingOverride | null>(null);
  const [localMappingOverrides, setLocalMappingOverrides] = useState<LocalMappingOverride[]>([]);
  const [siteRecipes, setSiteRecipes] = useState<SiteRecipe[]>([]);
  const [recipeJson, setRecipeJson] = useState("");
  const [status, setStatus] = useState<string>("Import or create a profile, then scan the active page.");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshConsent();
    void refreshActiveTabStatus();
    void refreshExecutionMode();
    void refreshSiteRecipes();
    void refreshEncryptionStatus();
    void refreshProfileSummaries();
    void send({ type: "GET_SELECTED_PROFILE" }).then((response) => {
      if (response.ok && response.type === "GET_SELECTED_PROFILE") {
        setProfile(response.profile);
        if (response.profile) setProfileJson(JSON.stringify(response.profile, null, 2));
        if (response.profile) void refreshProfileVariants(response.profile.meta.profileId);
      }
    });
  }, []);

  async function refreshEncryptionStatus() {
    const response = await send({ type: "GET_ENCRYPTION_STATUS" });
    if (response.ok && response.type === "GET_ENCRYPTION_STATUS") setEncryptionStatus(response.status);
  }

  async function refreshProfileSummaries() {
    const response = await send({ type: "LIST_PROFILES" });
    if (response.ok && response.type === "LIST_PROFILES") {
      setProfileSummaries(response.profiles);
      await refreshProfileVariants(response.profiles.find((summary) => summary.selected)?.profileId);
    }
  }

  async function refreshProfileVariants(baseProfileId: string | undefined) {
    if (!baseProfileId) {
      setVariantSummaries([]);
      return;
    }
    const response = await send({ type: "LIST_PROFILE_VARIANTS", baseProfileId });
    if (response.ok && response.type === "LIST_PROFILE_VARIANTS") applyVariantResponse(response);
  }

  function applyVariantResponse(response: {
    variants: ProfileVariantSummary[];
    selectedVariantId?: string;
    selectedVariant?: ProfileVariant | null;
  }) {
    setVariantSummaries(response.variants);
    setSelectedVariant(response.selectedVariant ?? null);
    if (response.selectedVariant) {
      setVariantLabel(response.selectedVariant.label);
      setVariantRole(response.selectedVariant.targetRole ?? "");
      setVariantJson(JSON.stringify(response.selectedVariant.overrides, null, 2));
    } else {
      setVariantLabel("");
      setVariantRole("");
    }
  }

  async function refreshConsent() {
    const response = await send({ type: "GET_FIRST_RUN_CONSENT" });
    if (response.ok && response.type === "GET_FIRST_RUN_CONSENT") setConsent(response.consent);
  }

  async function refreshActiveTabStatus() {
    const response = await send({ type: "GET_ACTIVE_TAB_STATUS" });
    if (response.ok && response.type === "GET_ACTIVE_TAB_STATUS") setActiveTabStatus(response.status);
  }

  async function refreshExecutionMode() {
    const response = await send({ type: "GET_EXECUTION_MODE" });
    if (response.ok && response.type === "GET_EXECUTION_MODE") setExecutionModeState(response.mode);
  }

  async function refreshSiteRecipes() {
    const response = await send({ type: "LIST_SITE_RECIPES" });
    if (response.ok && response.type === "LIST_SITE_RECIPES") setSiteRecipes(response.recipes);
  }

  function fieldForStep(step: FillStep): SerializableFieldCandidate | undefined {
    return scan?.fields.find((field) => field.id === step.target.candidateId);
  }

  function applyDraftToStep(step: FillStep): FillStep {
    const draftKey = mappingDrafts[step.target.candidateId];
    if (!draftKey || !effectiveProfile || !plan) return step;

    const field = fieldForStep(step);
    if (!field) return step;

    return stepFromMatch(
      {
        candidateId: field.id,
        canonicalKey: draftKey,
        confidence: 1,
        evidence: [{ type: "userOverride", text: step.target.label, weight: 1 }],
        adapterId: plan.adapterId,
        fillable: field.geometry.visible && !field.state.disabled,
        requiresReview: isSensitiveField(draftKey),
        node: field
      },
      effectiveProfile
    );
  }

  const activeVariantSummary = variantSummaries.find((variant) => variant.selected);
  const effectiveProfile = useMemo(() => (profile ? applyProfileVariant(profile, selectedVariant) : null), [profile, selectedVariant]);

  const effectivePlan = useMemo<FillPlan | null>(() => {
    if (!plan) return null;
    return { ...plan, steps: plan.steps.map(applyDraftToStep) };
  }, [plan, mappingDrafts, effectiveProfile, scan]);

  const counts = useMemo(() => {
    const steps = effectivePlan?.steps ?? [];
    return {
      auto: steps.filter((step) => canFill(step) && !step.requiresReview).length,
      review: steps.filter((step) => step.requiresReview).length,
      manual: steps.filter((step) => step.type === "manual" || step.type === "uploadFile").length
    };
  }, [effectivePlan]);

  const diagnostics = useMemo(() => {
    const hostname = hostnameFromUrl(scan?.url);
    const parser = inspection?.diagnostics.parser;
    return {
      adapterId: parser?.adapterId ?? scan?.platform.adapterId ?? "none",
      hostname: hostname || "unknown",
      scannedElements: parser?.scannedElements ?? scan?.fields.length ?? 0,
      fieldCount: parser?.candidateFields ?? scan?.fields.length ?? 0,
      stepCount: effectivePlan?.steps.length ?? 0,
      warningCount: parser?.warnings.length ?? effectivePlan?.warnings.length ?? 0,
      sectionsDetected: parser?.sectionsDetected ?? 0,
      repeatableGroupsDetected: parser?.repeatableGroupsDetected ?? 0,
      highConfidenceMatches: parser?.highConfidenceMatches ?? 0,
      reviewRequiredMatches: parser?.reviewRequiredMatches ?? 0,
      manualSteps: parser?.manualSteps ?? 0,
      skippedFields: parser?.skippedFields ?? 0,
      parserVersion: parser?.parserVersion ?? "none",
      overrideCount: siteOverride?.fields.length ?? 0,
      localOverrideCount: localMappingOverrides.length,
      recipeCount: siteRecipes.length,
      pageActionCount: inspection?.diagnostics.pageActions?.length ?? 0,
      appliedOverrideCount: inspection?.diagnostics.appliedOverrideIds?.length ?? 0,
      appliedRecipeCount: inspection?.diagnostics.appliedRecipeIds?.length ?? 0,
      permissionState: activeTabStatus?.permissionState ?? "unknown",
      restricted: scan?.platform.restricted || activeTabStatus?.platform.restricted ? "yes" : "no",
      copyOnly: scan?.platform.copyOnly || activeTabStatus?.platform.copyOnly ? "yes" : "no",
      variant: activeVariantSummary?.label ?? "none"
    };
  }, [scan, inspection, effectivePlan, siteOverride, localMappingOverrides, siteRecipes, activeTabStatus, activeVariantSummary]);

  const profileSnippets = useMemo(() => (effectiveProfile ? buildProfileSnippets(effectiveProfile) : []), [effectiveProfile]);
  const resumeDocuments = useMemo(() => documentsByType(profile, "resume"), [profile]);
  const coverLetterDocuments = useMemo(() => documentsByType(profile, "coverLetter"), [profile]);

  function syncProfileEditor(nextProfile: CandidateProfile) {
    setProfile(nextProfile);
    setProfileJson(JSON.stringify(nextProfile, null, 2));
    setInspection(null);
    setPlan(null);
    setAccepted(new Set());
  }

  function updateVariantDocumentId(key: "resumeDocumentId" | "coverLetterDocumentId", documentId: string) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(variantJson) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    if (documentId) parsed[key] = documentId;
    else delete parsed[key];
    setVariantJson(JSON.stringify(parsed, null, 2));
  }

  function variantDocumentId(key: "resumeDocumentId" | "coverLetterDocumentId"): string {
    try {
      const parsed = JSON.parse(variantJson) as Record<string, unknown>;
      return typeof parsed[key] === "string" ? parsed[key] : "";
    } catch {
      return "";
    }
  }

  async function loadSiteOverrides(nextScan: ScanState): Promise<SiteMappingOverride | null> {
    const hostname = hostnameFromUrl(nextScan.url);
    if (!hostname) {
      setSiteOverride(null);
      return null;
    }

    const response = await send({ type: "GET_SITE_OVERRIDES", hostname, adapterId: nextScan.platform.adapterId });
    if (response.ok && response.type === "GET_SITE_OVERRIDES") {
      setSiteOverride(response.override);
      return response.override;
    }

    if (!response.ok) setError(response.error);
    return null;
  }

  async function loadLocalMappingOverrides(nextScan: ScanState): Promise<LocalMappingOverride[]> {
    const hostname = hostnameFromUrl(nextScan.url);
    if (!hostname) {
      setLocalMappingOverrides([]);
      return [];
    }

    const response = await send({ type: "LIST_LOCAL_MAPPING_OVERRIDES", hostname, adapterId: nextScan.platform.adapterId });
    if (response.ok && response.type === "LIST_LOCAL_MAPPING_OVERRIDES") {
      setLocalMappingOverrides(response.overrides);
      return response.overrides;
    }

    if (!response.ok) setError(response.error);
    return [];
  }

  async function saveProfileFromJson() {
    setError(null);
    if (!encryptionStatus?.unlocked) {
      setError("Unlock encrypted profile storage before saving.");
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(profileJson) as unknown;
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid JSON.");
      return;
    }

    const result = safeParseCandidateProfile(parsedJson);
    if (!result.success) {
      setError(result.error.issues.map((issue) => issue.message).join("; "));
      return;
    }
    const response = await send({ type: "SAVE_PROFILE", profile: result.data });
    if (response.ok && response.type === "SAVE_PROFILE") {
      setProfile(response.profile);
      await refreshEncryptionStatus();
      await refreshProfileSummaries();
      await refreshProfileVariants(response.profile.meta.profileId);
      setStatus("Profile saved locally.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function exportProfile() {
    setError(null);
    if (!encryptionStatus?.unlocked) {
      setError("Unlock profiles before exporting.");
      return;
    }

    const response = await send({ type: "EXPORT_PROFILE" });
    if (response.ok && response.type === "EXPORT_PROFILE" && response.profile) {
      setProfileJson(JSON.stringify(response.profile, null, 2));
      setStatus("Profile loaded into the editor for export.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function deleteData() {
    const response = await send({ type: "DELETE_ALL_DATA" });
    if (response.ok) {
      setProfile(null);
      setProfileJson(JSON.stringify(sampleProfile, null, 2));
      setInspection(null);
      setPlan(null);
      setSiteOverride(null);
      setMappingDrafts({});
      setAccepted(new Set());
      applyVariantResponse({ variants: [] });
      await refreshConsent();
      await refreshEncryptionStatus();
      await refreshProfileSummaries();
      setStatus("Local profile data deleted.");
    } else {
      setError(response.error);
    }
  }

  async function scanPage() {
    setError(null);
    if (!consent?.accepted) {
      setError("Review and accept the privacy disclosure before scanning.");
      return;
    }
    setPlan(null);
    setInspection(null);
    setMappingDrafts({});
    const response = await send({ type: "INSPECT_PAGE" });
    if (response.ok && response.type === "INSPECT_PAGE") {
      await refreshActiveTabStatus();
      const nextScan = { fields: response.inspection.fields, platform: response.inspection.platform, url: response.inspection.url };
      setInspection(response.inspection);
      setScan(nextScan);
      setExecutionModeState(response.inspection.executionMode);
      setPlan(response.inspection.plan);
      setSiteOverride(response.inspection.options?.siteOverride ?? null);
      setLocalMappingOverrides(response.inspection.options?.localMappingOverrides ?? []);
      setAccepted(new Set(response.inspection.acceptedCandidateIds));
      if (response.inspection.platform.copyOnly) {
        setSiteOverride(null);
        setStatus("LinkedIn detected. Copy-assist mode is available; automated scanning and filling are disabled.");
        return;
      }
      setStatus(
        `Inspection ready: ${response.inspection.fields.length} fields, ${response.inspection.plan.steps.length} planned steps, ${modeLabel(response.inspection.executionMode)} mode.`
      );
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function buildPlan() {
    if (scan?.platform.copyOnly) {
      setError("Copy-assist platforms do not support automated fill plans.");
      return;
    }
    if (!profile || !scan) {
      setError("Save a profile and scan a page first.");
      return;
    }
    if (!encryptionStatus?.unlocked) {
      setError("Unlock profiles before building a fill plan.");
      return;
    }
    const response = await send({ type: "BUILD_FILL_PLAN", profile, fields: scan.fields, platform: scan.platform });
    if (response.ok && response.type === "BUILD_FILL_PLAN") {
      setPlan(response.plan);
      setSiteOverride(response.options?.siteOverride ?? siteOverride);
      setLocalMappingOverrides(response.options?.localMappingOverrides ?? localMappingOverrides);
      setMappingDrafts({});
      setAccepted(new Set(selectedAutoSteps(response.plan)));
      setStatus("Fill plan ready for review.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function changeExecutionMode(mode: ExecutionMode) {
    const response = await send({ type: "SET_EXECUTION_MODE", mode });
    if (response.ok && response.type === "SET_EXECUTION_MODE") {
      setExecutionModeState(response.mode);
      setAccepted(new Set(response.mode === "conservative" ? selectedAutoSteps(effectivePlan) : []));
      setStatus(`${modeLabel(response.mode)} mode selected. Inspect again to rebuild diagnostics with this mode.`);
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function fillAccepted() {
    if (!effectivePlan || scan?.platform.copyOnly) return;
    const response = await send({ type: "EXECUTE_FILL_PLAN", plan: effectivePlan, acceptedElementIds: Array.from(accepted) });
    if (response.ok && response.type === "EXECUTE_FILL_PLAN") {
      const { completedSteps, skippedSteps, manualSteps, status: fillStatus } = response.result;
      setStatus(`Fill ${fillStatus}: ${completedSteps} filled, ${skippedSteps} skipped, ${manualSteps} manual.`);
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  function toggleAccepted(candidateId: string) {
    setAccepted((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  }

  function changeMapping(candidateId: string, canonicalKey: CanonicalFieldKey) {
    setMappingDrafts((current) => ({ ...current, [candidateId]: canonicalKey }));
    setAccepted((current) => {
      const next = new Set(current);
      next.delete(candidateId);
      return next;
    });
  }

  async function saveMapping(step: FillStep) {
    if (!scan) return;
    const canonicalKey = stepCanonicalKey(applyDraftToStep(step));
    const hostname = hostnameFromUrl(scan.url);
    if (!canonicalKey || !hostname) return;
    const field = fieldForStep(step);
    if (!field) return;

    const legacyResponse = await send({
      type: "SAVE_SITE_OVERRIDE",
      hostname,
      adapterId: scan.platform.adapterId,
      override: {
        canonicalKey,
        elementSelector: step.target.selector,
        label: step.target.label
      }
    });
    const localResponse = await send({
      type: "SAVE_LOCAL_MAPPING_OVERRIDE",
      override: createLocalMappingOverride({
        hostname,
        adapterId: scan.platform.adapterId,
        field,
        canonicalKey
      })
    });

    if (legacyResponse.ok && legacyResponse.type === "SAVE_SITE_OVERRIDE" && localResponse.ok && localResponse.type === "SAVE_LOCAL_MAPPING_OVERRIDE") {
      const savedStep = applyDraftToStep(step);
      setSiteOverride(legacyResponse.override);
      await loadLocalMappingOverrides(scan);
      setPlan((current) =>
        current
          ? {
              ...current,
              steps: current.steps.map((candidate) => (candidate.target.candidateId === step.target.candidateId ? savedStep : candidate))
            }
          : current
      );
      setMappingDrafts((current) => {
        const next = { ...current };
        delete next[step.target.candidateId];
        return next;
      });
      setStatus("Mapping saved for this site.");
    } else if (!legacyResponse.ok) {
      setError(legacyResponse.error);
    } else if (!localResponse.ok) {
      setError(localResponse.error);
    }
  }

  async function copySnippet(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setStatus(`${label} copied.`);
  }

  async function copyDocumentValue(label: string, value: string | undefined) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setStatus(`${label} copied.`);
  }

  async function importRecipeFromJson() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(recipeJson);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid recipe JSON.");
      return;
    }
    const response = await send({ type: "IMPORT_SITE_RECIPE", recipe: parsed });
    if (response.ok && response.type === "IMPORT_SITE_RECIPE") {
      setSiteRecipes(response.recipes);
      setRecipeJson(JSON.stringify(response.recipe, null, 2));
      setStatus("Site recipe imported locally.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function exportRecipesToEditor() {
    const response = await send({ type: "EXPORT_SITE_RECIPES" });
    if (response.ok && response.type === "EXPORT_SITE_RECIPES") {
      setSiteRecipes(response.recipes);
      setRecipeJson(JSON.stringify(response.recipes, null, 2));
      setStatus("Site recipes exported to the editor.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function deleteRecipe(recipeId: string) {
    const response = await send({ type: "DELETE_SITE_RECIPE", recipeId });
    if (response.ok && response.type === "DELETE_SITE_RECIPE") {
      setSiteRecipes(response.recipes);
      setStatus("Site recipe deleted.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function acceptConsent() {
    setError(null);
    const response = await send({ type: "ACCEPT_FIRST_RUN_CONSENT" });
    if (response.ok && response.type === "ACCEPT_FIRST_RUN_CONSENT") {
      setConsent(response.consent);
      setStatus("Privacy disclosure accepted. You can now set up encrypted storage and scan pages.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function setStorePassphrase() {
    setError(null);
    const response = await send({ type: "SET_PASSPHRASE", passphrase });
    if (response.ok && response.type === "SET_PASSPHRASE") {
      setEncryptionStatus(response.status);
      setProfile(response.profile);
      if (response.profile) setProfileJson(JSON.stringify(response.profile, null, 2));
      setPassphrase("");
      await refreshProfileSummaries();
      await refreshProfileVariants(response.profile?.meta.profileId);
      setStatus(response.status.hasLegacyProfiles ? "Profile encryption configured." : "Encrypted profile storage ready.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function unlockStore() {
    setError(null);
    const response = await send({ type: "UNLOCK_PROFILE_STORE", passphrase: unlockPassphrase });
    if (response.ok && response.type === "UNLOCK_PROFILE_STORE") {
      setEncryptionStatus(response.status);
      setProfile(response.profile);
      if (response.profile) setProfileJson(JSON.stringify(response.profile, null, 2));
      setUnlockPassphrase("");
      await refreshProfileSummaries();
      await refreshProfileVariants(response.profile?.meta.profileId);
      setStatus("Profiles unlocked.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function lockStore() {
    setError(null);
    const response = await send({ type: "LOCK_PROFILE_STORE" });
    if (response.ok && response.type === "LOCK_PROFILE_STORE") {
      setEncryptionStatus(response.status);
      setProfile(null);
      setProfileJson(JSON.stringify(sampleProfile, null, 2));
      setPlan(null);
      setMappingDrafts({});
      setAccepted(new Set());
      applyVariantResponse({ variants: [] });
      await refreshProfileSummaries();
      setStatus("Profiles locked.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function selectSavedProfile(profileId: string) {
    setError(null);
    const response = await send({ type: "SELECT_PROFILE", profileId });
    if (response.ok && response.type === "SELECT_PROFILE") {
      setProfileSummaries(response.profiles);
      setProfile(response.profile);
      if (response.profile) setProfileJson(JSON.stringify(response.profile, null, 2));
      else setProfileJson(JSON.stringify(sampleProfile, null, 2));
      setPlan(null);
      setMappingDrafts({});
      setAccepted(new Set());
      await refreshProfileVariants(profileId);
      await refreshEncryptionStatus();
      setStatus(response.profile ? "Selected profile loaded." : "Selected profile. Unlock profiles to edit or export it.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function deleteSelectedProfile() {
    const selected = profileSummaries.find((summary) => summary.selected);
    if (!selected) return;

    setError(null);
    const response = await send({ type: "DELETE_PROFILE", profileId: selected.profileId });
    if (response.ok && response.type === "DELETE_PROFILE") {
      setProfileSummaries(response.profiles);
      setProfile(response.profile);
      if (response.profile) setProfileJson(JSON.stringify(response.profile, null, 2));
      else setProfileJson(JSON.stringify(sampleProfile, null, 2));
      setPlan(null);
      setMappingDrafts({});
      setAccepted(new Set());
      await refreshProfileVariants(response.profiles.find((summary) => summary.selected)?.profileId);
      await refreshEncryptionStatus();
      setStatus("Profile deleted.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function selectVariant(nextVariantId: string) {
    const baseProfileId = profile?.meta.profileId ?? selectedProfileSummary?.profileId;
    if (!baseProfileId) return;

    setError(null);
    const response = await send({
      type: "SELECT_PROFILE_VARIANT",
      baseProfileId,
      variantId: nextVariantId || null
    });
    if (response.ok && response.type === "SELECT_PROFILE_VARIANT") {
      applyVariantResponse(response);
      setPlan(null);
      setAccepted(new Set());
      setStatus(response.selectedVariant ? "Role variant selected." : "Role variant cleared.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function saveVariant() {
    const baseProfileId = profile?.meta.profileId ?? selectedProfileSummary?.profileId;
    if (!baseProfileId) {
      setError("Select a base profile first.");
      return;
    }

    let overrides: ProfileVariant["overrides"];
    try {
      overrides = validateVariantOverrides(JSON.parse(variantJson));
    } catch (variantError) {
      setError(variantError instanceof Error ? variantError.message : "Invalid role variant JSON.");
      return;
    }

    const label = variantLabel.trim();
    if (!label) {
      setError("Variant label is required.");
      return;
    }

    setError(null);
    const response = await send({
      type: "SAVE_PROFILE_VARIANT",
      variant: {
        variantId: selectedVariant?.variantId ?? variantId(),
        baseProfileId,
        label,
        targetRole: variantRole.trim() || undefined,
        overrides
      }
    });
    if (response.ok && response.type === "SAVE_PROFILE_VARIANT") {
      applyVariantResponse(response);
      setPlan(null);
      setAccepted(new Set());
      setStatus("Role variant saved.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  async function deleteVariant() {
    const baseProfileId = profile?.meta.profileId ?? selectedProfileSummary?.profileId;
    if (!baseProfileId || !selectedVariant) return;

    setError(null);
    const response = await send({
      type: "DELETE_PROFILE_VARIANT",
      baseProfileId,
      variantId: selectedVariant.variantId
    });
    if (response.ok && response.type === "DELETE_PROFILE_VARIANT") {
      applyVariantResponse(response);
      setPlan(null);
      setAccepted(new Set());
      setStatus("Role variant deleted.");
    } else if (!response.ok) {
      setError(response.error);
    }
  }

  function editDocument(document: CandidateDocument) {
    setDocumentForm({ ...document, tags: document.tags ?? [] });
  }

  function saveDocumentMetadata() {
    if (!profile || !encryptionStatus?.unlocked) {
      setError("Unlock and select a profile before editing documents.");
      return;
    }

    const documentId = documentForm.id.trim();
    const label = documentForm.label.trim();
    if (!documentId || !label) {
      setError("Document id and label are required.");
      return;
    }

    const nextProfile = upsertProfileDocument(profile, {
      ...documentForm,
      id: documentId,
      label,
      fileName: documentForm.fileName?.trim() || undefined,
      mimeType: documentForm.mimeType?.trim() || undefined,
      description: documentForm.description?.trim() || undefined,
      targetRole: documentForm.targetRole?.trim() || undefined,
      tags: documentForm.tags?.map((tag) => tag.trim()).filter(Boolean)
    });

    syncProfileEditor(nextProfile);
    setDocumentForm(defaultDocumentForm());
    setError(null);
    setStatus("Document metadata updated in the profile editor. Save profile to persist it.");
  }

  function deleteDocumentMetadata(documentId: string) {
    if (!profile || !encryptionStatus?.unlocked) return;
    syncProfileEditor(deleteProfileDocument(profile, documentId));
    setStatus("Document metadata removed from the profile editor. Save profile to persist it.");
  }

  const isCopyOnly = Boolean(scan?.platform.copyOnly);
  const selectedProfileSummary = profileSummaries.find((summary) => summary.selected);

  if (consent && !consent.accepted) {
    return (
      <main className="panel-shell">
        <header className="panel-header">
          <div>
            <h1>Job Autofill</h1>
            <p>Privacy disclosure</p>
          </div>
        </header>
        {error ? <p className="notice error">{error}</p> : null}
        <section className="section consent-card">
          <h2>Before You Start</h2>
          <p className="help-text">
            This extension stores profile data locally in your browser. Profiles are encrypted with your passphrase before saving. No
            backend, sync, telemetry, scraping, or remote code is used.
          </p>
          <ul className="consent-list">
            <li>You review every fill plan before anything is filled.</li>
            <li>The extension never submits applications, creates accounts, logs in, or bypasses CAPTCHA or assessments.</li>
            <li>LinkedIn is copy-assist only. The extension does not scan, modify, or fill LinkedIn pages.</li>
            <li>Supported ATS site access is requested only when you click Scan page.</li>
          </ul>
          <button className="primary" onClick={acceptConsent}>
            Accept and continue
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="panel-shell">
      <header className="panel-header">
        <div>
          <h1>Job Autofill</h1>
          <p>{profile?.meta.label ?? selectedProfileSummary?.label ?? "No profile saved"}</p>
        </div>
        <button disabled={!consent?.accepted} onClick={scanPage}>
          Inspect page
        </button>
      </header>

      {error ? <p className="notice error">{error}</p> : <p className="notice">{status}</p>}

      <section className="section">
        <h2>Encrypted Storage</h2>
        <p className="help-text">
          Profiles are encrypted locally with your passphrase before they are saved. If the passphrase is lost, encrypted profile data
          cannot be recovered.
        </p>
        {!encryptionStatus?.configured || encryptionStatus.hasLegacyProfiles ? (
          <div className="button-row">
            <input
              className="text-input"
              type="password"
              value={passphrase}
              placeholder="Set passphrase"
              onChange={(event) => setPassphrase(event.target.value)}
            />
            <button disabled={!passphrase} onClick={setStorePassphrase}>
              Set passphrase
            </button>
          </div>
        ) : null}
        {encryptionStatus?.configured && !encryptionStatus.unlocked ? (
          <div className="button-row">
            <input
              className="text-input"
              type="password"
              value={unlockPassphrase}
              placeholder="Unlock passphrase"
              onChange={(event) => setUnlockPassphrase(event.target.value)}
            />
            <button disabled={!unlockPassphrase} onClick={unlockStore}>
              Unlock profiles
            </button>
          </div>
        ) : null}
        {encryptionStatus?.unlocked ? (
          <div className="button-row">
            <span className="status-pill status-auto">Unlocked</span>
            <button onClick={lockStore}>Lock</button>
          </div>
        ) : null}
      </section>

      <section className="section">
        <h2>Profile JSON</h2>
        <div className="profile-selector-row">
          <select
            value={selectedProfileSummary?.profileId ?? ""}
            disabled={profileSummaries.length === 0}
            onChange={(event) => selectSavedProfile(event.target.value)}
          >
            <option value="" disabled>
              {profileSummaries.length === 0 ? "No saved profiles" : "Select profile"}
            </option>
            {profileSummaries.map((summary) => (
              <option key={summary.profileId} value={summary.profileId}>
                {summary.label} - {new Date(summary.updatedAt).toLocaleDateString()}
              </option>
            ))}
          </select>
          <button className="danger" disabled={!selectedProfileSummary} onClick={deleteSelectedProfile}>
            Delete selected
          </button>
        </div>
        {encryptionStatus?.unlocked ? (
          <textarea
            className="json-editor"
            value={profileJson}
            onChange={(event) => setProfileJson(event.target.value)}
            spellCheck={false}
          />
        ) : (
          <p className="help-text">Unlock profiles to view, edit, import, or export profile JSON. Saved profile labels remain visible while locked.</p>
        )}
        <div className="button-row">
          <button className="primary" disabled={!encryptionStatus?.unlocked} onClick={saveProfileFromJson}>
            Save profile
          </button>
          <button disabled={!encryptionStatus?.unlocked} onClick={exportProfile}>
            Export
          </button>
          <button className="danger" onClick={deleteData}>
            Delete data
          </button>
        </div>
      </section>

      <section className="section">
        <h2>Role Variant</h2>
        <p className="help-text">
          Variants tailor safe fields for a role without changing the selected base profile. Sensitive answers cannot be overridden.
        </p>
        <div className="profile-selector-row">
          <select
            value={selectedVariant?.variantId ?? ""}
            disabled={!selectedProfileSummary || variantSummaries.length === 0}
            onChange={(event) => selectVariant(event.target.value)}
          >
            <option value="">No variant</option>
            {variantSummaries.map((variant) => (
              <option key={variant.variantId} value={variant.variantId}>
                {variant.label}
                {variant.targetRole ? ` - ${variant.targetRole}` : ""}
              </option>
            ))}
          </select>
          <button disabled={!selectedVariant} onClick={() => selectVariant("")}>
            Clear
          </button>
          <button className="danger" disabled={!selectedVariant} onClick={deleteVariant}>
            Delete variant
          </button>
        </div>
        <div className="button-row">
          <input
            className="text-input"
            value={variantLabel}
            placeholder="Variant label"
            onChange={(event) => setVariantLabel(event.target.value)}
          />
          <input
            className="text-input"
            value={variantRole}
            placeholder="Target role"
            onChange={(event) => setVariantRole(event.target.value)}
          />
        </div>
        <div className="document-selector-grid">
          <label>
            Resume
            <select
              value={variantDocumentId("resumeDocumentId")}
              disabled={resumeDocuments.length === 0}
              onChange={(event) => updateVariantDocumentId("resumeDocumentId", event.target.value)}
            >
              <option value="">Base profile resume</option>
              {resumeDocuments.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.label}
                  {document.fileName ? ` - ${document.fileName}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cover letter
            <select
              value={variantDocumentId("coverLetterDocumentId")}
              disabled={coverLetterDocuments.length === 0}
              onChange={(event) => updateVariantDocumentId("coverLetterDocumentId", event.target.value)}
            >
              <option value="">Base profile cover letter</option>
              {coverLetterDocuments.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.label}
                  {document.fileName ? ` - ${document.fileName}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          className="json-editor compact-editor"
          value={variantJson}
          onChange={(event) => setVariantJson(event.target.value)}
          spellCheck={false}
        />
        <div className="button-row">
          <button className="primary" disabled={!selectedProfileSummary} onClick={saveVariant}>
            Save variant
          </button>
        </div>
      </section>

      <section className="section">
        <h2>Documents</h2>
        <p className="help-text">
          Store document metadata inside the encrypted profile. File uploads remain manual on job application pages.
        </p>
        <div className="field-list">
          {(profile?.documents ?? []).map((document) => (
            <div key={document.id} className="document-row">
              <div>
                <strong>
                  {document.label}
                  {document.fileName ? ` (${document.fileName})` : ""}
                </strong>
                <small>
                  {document.type} - {document.id}
                  {document.targetRole ? ` - ${document.targetRole}` : ""}
                  {document.updatedAt ? ` - ${new Date(document.updatedAt).toLocaleDateString()}` : ""}
                </small>
                {document.description ? <p className="help-text">{document.description}</p> : null}
                {document.tags?.length ? <small>Tags: {document.tags.join(", ")}</small> : null}
              </div>
              <div className="document-actions">
                <button onClick={() => copyDocumentValue("Document id", document.id)}>Copy id</button>
                <button disabled={!document.fileName} onClick={() => copyDocumentValue("Filename", document.fileName)}>
                  Copy filename
                </button>
                <button disabled={!encryptionStatus?.unlocked} onClick={() => editDocument(document)}>
                  Edit
                </button>
                <button className="danger" disabled={!encryptionStatus?.unlocked} onClick={() => deleteDocumentMetadata(document.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {profile && (profile.documents ?? []).length === 0 ? <p className="help-text">No documents saved for this profile.</p> : null}
          {!profile ? <p className="help-text">Unlock and select a profile to manage document metadata.</p> : null}
        </div>
        <div className="document-form-grid">
          <label>
            Type
            <select
              value={documentForm.type}
              disabled={!profile || !encryptionStatus?.unlocked}
              onChange={(event) => setDocumentForm((current) => ({ ...current, type: event.target.value as CandidateDocument["type"] }))}
            >
              <option value="resume">Resume</option>
              <option value="coverLetter">Cover letter</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Document id
            <input
              className="text-input"
              value={documentForm.id}
              disabled={!profile || !encryptionStatus?.unlocked}
              placeholder="resume_frontend"
              onChange={(event) => setDocumentForm((current) => ({ ...current, id: event.target.value }))}
            />
          </label>
          <label>
            Label
            <input
              className="text-input"
              value={documentForm.label}
              disabled={!profile || !encryptionStatus?.unlocked}
              placeholder="Frontend Resume"
              onChange={(event) => setDocumentForm((current) => ({ ...current, label: event.target.value }))}
            />
          </label>
          <label>
            Filename
            <input
              className="text-input"
              value={documentForm.fileName ?? ""}
              disabled={!profile || !encryptionStatus?.unlocked}
              placeholder="frontend-resume.pdf"
              onChange={(event) => setDocumentForm((current) => ({ ...current, fileName: event.target.value }))}
            />
          </label>
          <label>
            Target role
            <input
              className="text-input"
              value={documentForm.targetRole ?? ""}
              disabled={!profile || !encryptionStatus?.unlocked}
              placeholder="Frontend"
              onChange={(event) => setDocumentForm((current) => ({ ...current, targetRole: event.target.value }))}
            />
          </label>
          <label>
            Tags
            <input
              className="text-input"
              value={(documentForm.tags ?? []).join(", ")}
              disabled={!profile || !encryptionStatus?.unlocked}
              placeholder="frontend, react"
              onChange={(event) =>
                setDocumentForm((current) => ({
                  ...current,
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                }))
              }
            />
          </label>
          <label className="full-width">
            Description
            <textarea
              className="json-editor compact-editor"
              value={documentForm.description ?? ""}
              disabled={!profile || !encryptionStatus?.unlocked}
              placeholder="When to use this document"
              onChange={(event) => setDocumentForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
        </div>
        <div className="button-row">
          <button className="primary" disabled={!profile || !encryptionStatus?.unlocked} onClick={saveDocumentMetadata}>
            Save document metadata
          </button>
          <button disabled={!profile || !encryptionStatus?.unlocked} onClick={() => setDocumentForm(defaultDocumentForm())}>
            Clear form
          </button>
        </div>
      </section>

      <section className="section">
        <h2>Inspect And Review</h2>
        <div className="document-selector-grid">
          <label>
            Execution mode
            <select value={executionMode} onChange={(event) => changeExecutionMode(event.target.value as ExecutionMode)}>
              <option value="conservative">Conservative</option>
              <option value="assisted">Assisted</option>
              <option value="recorder">Recorder</option>
            </select>
          </label>
          <label>
            Current result
            <span className="readonly-field">{inspection ? `${inspection.plan.steps.length} planned steps` : "No inspection yet"}</span>
          </label>
        </div>
        <p className="help-text">
          Conservative fills only safe high-confidence fields by default. Assisted and Recorder start with fields unselected for manual approval.
        </p>
        <div className="summary-grid">
          <span>{scan?.platform.label ?? "No scan"}</span>
          <span>{scan?.fields.length ?? 0} fields</span>
          <button disabled={!scan || !profile || isCopyOnly || !encryptionStatus?.unlocked} onClick={buildPlan}>
            Rebuild fill plan
          </button>
        </div>
        <div className="field-list">
          {(scan?.fields ?? []).slice(0, 20).map((field) => (
            <div key={field.id} className="field-row">
              <strong>{field.accessibility.label ?? field.accessibility.ariaLabel ?? field.dom.placeholder ?? field.dom.name ?? field.dom.tagName}</strong>
              <span>
                {field.dom.tagName}
                {field.dom.type ? `/${field.dom.type}` : ""}
              </span>
            </div>
          ))}
        </div>
      </section>

      {isCopyOnly ? (
        <section className="section">
          <h2>LinkedIn Copy Assist</h2>
          <p className="help-text">
            LinkedIn is restricted. This extension will not scan, modify, or fill LinkedIn pages. Copy profile snippets here and paste
            them manually.
          </p>
          <div className="field-list">
            {profileSnippets.map((snippet) => (
              <div key={snippet.id} className="snippet-row">
                <div>
                  <strong>{snippet.label}</strong>
                  {snippet.description ? <small>{snippet.description}</small> : null}
                  <pre>{snippet.value}</pre>
                </div>
                <button onClick={() => copySnippet(snippet.label, snippet.value)}>Copy</button>
              </div>
            ))}
            {profile && profileSnippets.length === 0 ? <p className="help-text">No copyable profile fields are available.</p> : null}
            {!profile ? <p className="help-text">Save a profile to enable copy snippets.</p> : null}
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2>Diagnostics</h2>
        <div className="diagnostics-grid">
          <span>Adapter: {diagnostics.adapterId}</span>
          <span>Host: {diagnostics.hostname}</span>
          <span>Scanned: {diagnostics.scannedElements}</span>
          <span>Candidates: {diagnostics.fieldCount}</span>
          <span>Planned: {diagnostics.stepCount}</span>
          <span>Sections: {diagnostics.sectionsDetected}</span>
          <span>Groups: {diagnostics.repeatableGroupsDetected}</span>
          <span>High confidence: {diagnostics.highConfidenceMatches}</span>
          <span>Review matches: {diagnostics.reviewRequiredMatches}</span>
          <span>Manual: {diagnostics.manualSteps}</span>
          <span>Skipped: {diagnostics.skippedFields}</span>
          <span>Warnings: {diagnostics.warningCount}</span>
          <span>Parser: {diagnostics.parserVersion}</span>
          <span>Saved mappings: {diagnostics.overrideCount}</span>
          <span>Local mappings: {diagnostics.localOverrideCount}</span>
          <span>Recipes: {diagnostics.recipeCount}</span>
          <span>Actions: {diagnostics.pageActionCount}</span>
          <span>Applied overrides: {diagnostics.appliedOverrideCount}</span>
          <span>Applied recipes: {diagnostics.appliedRecipeCount}</span>
          <span>Permission: {diagnostics.permissionState}</span>
          <span>Restricted: {diagnostics.restricted}</span>
          <span>Copy-only: {diagnostics.copyOnly}</span>
          <span>Mode: {modeLabel(executionMode)}</span>
        </div>
        {inspection?.diagnostics.parser.warnings.length ? (
          <div className="field-list">
            {inspection.diagnostics.parser.warnings.map((warning, index) => (
              <p key={`${warning}-${index}`} className="help-text">
                {warning}
              </p>
            ))}
          </div>
        ) : null}
        {inspection?.diagnostics.pageActions?.length ? (
          <div className="field-list">
            {inspection.diagnostics.pageActions.map((action) => (
              <div key={action.id} className="field-row">
                <strong>{action.label}</strong>
                <span>
                  {action.type} - {Math.round(action.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="section">
        <h2>Site Recipes</h2>
        <p className="help-text">
          Recipes are local JSON hints for niche ATS pages. They suggest fields and actions, but never submit or navigate automatically.
        </p>
        <div className="field-list">
          {siteRecipes.map((recipe) => (
            <div key={recipe.id} className="field-row">
              <strong>{recipe.label}</strong>
              <span>{recipe.hostnamePattern}</span>
              <button className="danger" onClick={() => deleteRecipe(recipe.id)}>
                Delete
              </button>
            </div>
          ))}
          {siteRecipes.length === 0 ? <p className="help-text">No site recipes imported.</p> : null}
        </div>
        <textarea
          className="json-editor compact-editor"
          value={recipeJson}
          onChange={(event) => setRecipeJson(event.target.value)}
          spellCheck={false}
          placeholder='{"id":"example-ats","label":"Example ATS","hostnamePattern":"*.example.com","fields":{"personal.firstName":[{"selector":"#first","strategy":"css"}]}}'
        />
        <div className="button-row">
          <button className="primary" disabled={!recipeJson.trim()} onClick={importRecipeFromJson}>
            Import recipe
          </button>
          <button onClick={exportRecipesToEditor}>Export recipes</button>
        </div>
      </section>

      {!isCopyOnly ? <section className="section">
        <h2>Fill Plan</h2>
        <div className="summary-grid">
          <span>{counts.auto} auto</span>
          <span>{counts.review} review</span>
          <span>{counts.manual} manual</span>
        </div>
        <div className="field-list">
          {(effectivePlan?.steps ?? []).map((effectiveStep) => {
            const originalStep = plan?.steps.find((step) => step.target.candidateId === effectiveStep.target.candidateId) ?? effectiveStep;
            const stepDiagnostic = inspection?.diagnostics.steps.find((step) => step.candidateId === effectiveStep.target.candidateId);
            const currentKey = stepCanonicalKey(effectiveStep);
            const originalKey = stepCanonicalKey(originalStep);
            const draftChanged = Boolean(mappingDrafts[effectiveStep.target.candidateId] && currentKey !== originalKey);
            const fillable = canFill(effectiveStep);

            return (
              <div
                key={`${effectiveStep.target.candidateId}-${effectiveStep.type}`}
                className={`plan-row plan-row-${effectiveStep.type}${effectiveStep.requiresReview ? " plan-row-review" : ""}`}
              >
                <input
                  type="checkbox"
                  disabled={!fillable}
                  checked={accepted.has(effectiveStep.target.candidateId)}
                  onChange={() => toggleAccepted(effectiveStep.target.candidateId)}
                  title={fillable ? "Include this field" : "Manual fields cannot be filled automatically"}
                />
                <div className="plan-row-body">
                  <div className="plan-row-main">
                    <strong>{effectiveStep.target.label}</strong>
                    <span className={`status-pill status-${stepStatus(effectiveStep)}`}>{stepStatus(effectiveStep)}</span>
                  </div>
                  <small>
                    {currentKey ?? "No mapping"} - {valuePreview(effectiveStep, effectiveProfile)}
                    {"confidence" in effectiveStep ? ` - ${Math.round(effectiveStep.confidence * 100)}%` : ""}
                    {effectiveStep.requiresReview ? " - review required" : ""}
                    {stepDiagnostic?.driver ? ` - ${stepDiagnostic.driver}` : ""}
                    {stepDiagnostic?.sectionTitle ? ` - ${stepDiagnostic.sectionTitle}` : ""}
                    {stepDiagnostic?.repeatableGroup ? ` - ${stepDiagnostic.repeatableGroup.type} #${stepDiagnostic.repeatableGroup.index + 1}` : ""}
                  </small>
                  {stepDiagnostic?.evidence.length ? (
                    <div className="evidence-list">
                      {stepDiagnostic.evidence.map((evidence, index) => (
                        <span key={`${evidence.type}-${index}`}>
                          {evidence.type}: {evidence.text} ({Math.round(evidence.weight * 100)})
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mapping-row">
                    <select
                      value={currentKey ?? ""}
                      disabled={effectiveStep.type === "uploadFile"}
                      onChange={(event) => changeMapping(effectiveStep.target.candidateId, event.target.value as CanonicalFieldKey)}
                    >
                      <option value="" disabled>
                        Select mapping
                      </option>
                      {CANONICAL_FIELD_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                    <button disabled={!draftChanged || !currentKey} onClick={() => saveMapping(originalStep)}>
                      Save mapping
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="primary" disabled={!effectivePlan} onClick={fillAccepted}>
          Fill accepted fields
        </button>
      </section> : null}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
