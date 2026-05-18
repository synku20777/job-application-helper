import type {
  ActiveTabComplianceStatus,
  EncryptionStatus,
  FillOptions,
  FillPlan,
  FillResult,
  ExecutionMode,
  FirstRunConsentStatus,
  InspectionResult,
  LocalMappingOverride,
  PageAction,
  SerializableFieldCandidate,
  PlatformDetection,
  ProfileVariant,
  ProfileVariantSummary,
  ProfileSummary,
  SavedFieldOverride,
  SiteRecipe,
  SiteMappingOverride
} from "./types";
import type { CandidateProfile } from "@job-helper/profile-schema";

export type ExtensionMessage =
  | { type: "INSPECT_PAGE" }
  | { type: "SCAN_PAGE" }
  | { type: "BUILD_FILL_PLAN"; profile: CandidateProfile; fields: SerializableFieldCandidate[]; platform: PlatformDetection }
  | { type: "EXECUTE_FILL_PLAN"; plan: FillPlan; acceptedElementIds: string[] }
  | { type: "GET_EXECUTION_MODE" }
  | { type: "SET_EXECUTION_MODE"; mode: ExecutionMode }
  | { type: "GET_SELECTED_PROFILE" }
  | { type: "LIST_PROFILES" }
  | { type: "SELECT_PROFILE"; profileId: string }
  | { type: "DELETE_PROFILE"; profileId: string }
  | { type: "LIST_PROFILE_VARIANTS"; baseProfileId: string }
  | { type: "SAVE_PROFILE_VARIANT"; variant: Omit<ProfileVariant, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string } }
  | { type: "SELECT_PROFILE_VARIANT"; baseProfileId: string; variantId: string | null }
  | { type: "DELETE_PROFILE_VARIANT"; baseProfileId: string; variantId: string }
  | { type: "GET_FIRST_RUN_CONSENT" }
  | { type: "ACCEPT_FIRST_RUN_CONSENT" }
  | { type: "GET_ACTIVE_TAB_STATUS" }
  | { type: "GET_ENCRYPTION_STATUS" }
  | { type: "SET_PASSPHRASE"; passphrase: string }
  | { type: "UNLOCK_PROFILE_STORE"; passphrase: string }
  | { type: "LOCK_PROFILE_STORE" }
  | { type: "SAVE_PROFILE"; profile: CandidateProfile }
  | { type: "EXPORT_PROFILE" }
  | { type: "GET_SITE_OVERRIDES"; hostname: string; adapterId: string }
  | { type: "SAVE_SITE_OVERRIDE"; hostname: string; adapterId: string; override: Omit<SavedFieldOverride, "id" | "createdAt" | "updatedAt"> }
  | { type: "DELETE_SITE_OVERRIDE"; hostname: string; adapterId: string; overrideId: string }
  | { type: "LIST_LOCAL_MAPPING_OVERRIDES"; hostname: string; adapterId: string }
  | { type: "SAVE_LOCAL_MAPPING_OVERRIDE"; override: Omit<LocalMappingOverride, "id" | "createdAt" | "lastUsedAt" | "useCount"> }
  | { type: "DELETE_LOCAL_MAPPING_OVERRIDE"; overrideId: string }
  | { type: "LIST_SITE_RECIPES" }
  | { type: "IMPORT_SITE_RECIPE"; recipe: Omit<SiteRecipe, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string } }
  | { type: "EXPORT_SITE_RECIPES" }
  | { type: "DELETE_SITE_RECIPE"; recipeId: string }
  | { type: "DELETE_ALL_DATA" };

export type ExtensionResponse =
  | { ok: true; type: "INSPECT_PAGE"; inspection: InspectionResult }
  | { ok: true; type: "SCAN_PAGE"; fields: SerializableFieldCandidate[]; platform: PlatformDetection; url: string; pageActions?: PageAction[] }
  | { ok: true; type: "BUILD_FILL_PLAN"; plan: FillPlan; options?: FillOptions }
  | { ok: true; type: "EXECUTE_FILL_PLAN"; result: FillResult }
  | { ok: true; type: "GET_EXECUTION_MODE"; mode: ExecutionMode }
  | { ok: true; type: "SET_EXECUTION_MODE"; mode: ExecutionMode }
  | { ok: true; type: "GET_SELECTED_PROFILE"; profile: CandidateProfile | null }
  | { ok: true; type: "LIST_PROFILES"; profiles: ProfileSummary[] }
  | { ok: true; type: "SELECT_PROFILE"; profiles: ProfileSummary[]; profile: CandidateProfile | null }
  | { ok: true; type: "DELETE_PROFILE"; profiles: ProfileSummary[]; profile: CandidateProfile | null }
  | { ok: true; type: "LIST_PROFILE_VARIANTS"; variants: ProfileVariantSummary[]; selectedVariantId?: string; selectedVariant?: ProfileVariant | null }
  | { ok: true; type: "SAVE_PROFILE_VARIANT"; variants: ProfileVariantSummary[]; selectedVariantId?: string; selectedVariant?: ProfileVariant | null }
  | { ok: true; type: "SELECT_PROFILE_VARIANT"; variants: ProfileVariantSummary[]; selectedVariantId?: string; selectedVariant?: ProfileVariant | null }
  | { ok: true; type: "DELETE_PROFILE_VARIANT"; variants: ProfileVariantSummary[]; selectedVariantId?: string; selectedVariant?: ProfileVariant | null }
  | { ok: true; type: "GET_FIRST_RUN_CONSENT"; consent: FirstRunConsentStatus }
  | { ok: true; type: "ACCEPT_FIRST_RUN_CONSENT"; consent: FirstRunConsentStatus }
  | { ok: true; type: "GET_ACTIVE_TAB_STATUS"; status: ActiveTabComplianceStatus }
  | { ok: true; type: "GET_ENCRYPTION_STATUS"; status: EncryptionStatus }
  | { ok: true; type: "SET_PASSPHRASE"; status: EncryptionStatus; profile: CandidateProfile | null }
  | { ok: true; type: "UNLOCK_PROFILE_STORE"; status: EncryptionStatus; profile: CandidateProfile | null }
  | { ok: true; type: "LOCK_PROFILE_STORE"; status: EncryptionStatus }
  | { ok: true; type: "SAVE_PROFILE"; profile: CandidateProfile }
  | { ok: true; type: "EXPORT_PROFILE"; profile: CandidateProfile | null }
  | { ok: true; type: "GET_SITE_OVERRIDES"; override: SiteMappingOverride | null }
  | { ok: true; type: "SAVE_SITE_OVERRIDE"; override: SiteMappingOverride }
  | { ok: true; type: "DELETE_SITE_OVERRIDE"; override: SiteMappingOverride | null }
  | { ok: true; type: "LIST_LOCAL_MAPPING_OVERRIDES"; overrides: LocalMappingOverride[] }
  | { ok: true; type: "SAVE_LOCAL_MAPPING_OVERRIDE"; override: LocalMappingOverride }
  | { ok: true; type: "DELETE_LOCAL_MAPPING_OVERRIDE"; overrides: LocalMappingOverride[] }
  | { ok: true; type: "LIST_SITE_RECIPES"; recipes: SiteRecipe[] }
  | { ok: true; type: "IMPORT_SITE_RECIPE"; recipe: SiteRecipe; recipes: SiteRecipe[] }
  | { ok: true; type: "EXPORT_SITE_RECIPES"; recipes: SiteRecipe[] }
  | { ok: true; type: "DELETE_SITE_RECIPE"; recipes: SiteRecipe[] }
  | { ok: true; type: "DELETE_ALL_DATA" }
  | { ok: false; error: string };
