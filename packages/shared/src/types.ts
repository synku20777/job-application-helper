export type CanonicalFieldKey =
  | "personal.firstName"
  | "personal.middleName"
  | "personal.lastName"
  | "personal.email"
  | "personal.phone"
  | "personal.address.line1"
  | "personal.address.city"
  | "personal.address.region"
  | "personal.address.postalCode"
  | "personal.address.country"
  | "personal.links.linkedin"
  | "personal.links.github"
  | "personal.links.portfolio"
  | "demographics.gender"
  | "demographics.pronouns"
  | "workExperience.company"
  | "workExperience.title"
  | "workExperience.location"
  | "workExperience.startDate"
  | "workExperience.endDate"
  | "workExperience.current"
  | "workExperience.description"
  | "education.institution"
  | "education.degree"
  | "education.fieldOfStudy"
  | "education.startDate"
  | "education.endDate"
  | "skills"
  | "languages"
  | "documents.resume"
  | "documents.coverLetter"
  | "applicationDefaults.remotePreference"
  | "applicationDefaults.willingToRelocate"
  | "applicationDefaults.sponsorshipRequiredDefault";

export const CANONICAL_FIELD_KEYS: CanonicalFieldKey[] = [
  "personal.firstName",
  "personal.middleName",
  "personal.lastName",
  "personal.email",
  "personal.phone",
  "personal.address.line1",
  "personal.address.city",
  "personal.address.region",
  "personal.address.postalCode",
  "personal.address.country",
  "personal.links.linkedin",
  "personal.links.github",
  "personal.links.portfolio",
  "demographics.gender",
  "demographics.pronouns",
  "workExperience.company",
  "workExperience.title",
  "workExperience.location",
  "workExperience.startDate",
  "workExperience.endDate",
  "workExperience.current",
  "workExperience.description",
  "education.institution",
  "education.degree",
  "education.fieldOfStudy",
  "education.startDate",
  "education.endDate",
  "skills",
  "languages",
  "documents.resume",
  "documents.coverLetter",
  "applicationDefaults.remotePreference",
  "applicationDefaults.willingToRelocate",
  "applicationDefaults.sponsorshipRequiredDefault"
];

export type FieldEvidenceType =
  | "exactAdapterSelector"
  | "exactLabel"
  | "ariaLabel"
  | "autocomplete"
  | "nameOrId"
  | "placeholder"
  | "nearbyText"
  | "sectionContext"
  | "negativeLabel"
  | "labelExactMatch"
  | "ariaExactMatch"
  | "nameAttributeMatch"
  | "placeholderMatch"
  | "nearbyTextMatch"
  | "sectionContextMatch"
  | "fuzzyMatch"
  | "userOverride"
  | "sensitive";

export type MatchEvidence = {
  type: FieldEvidenceType;
  text: string;
  weight: number;
};

export type ElementTarget = {
  candidateId: string;
  selector: string;
  label: string;
};

export type FieldOption = {
  label: string;
  value: string;
};

export type SectionType =
  | "personal"
  | "experience"
  | "education"
  | "skills"
  | "documents"
  | "demographics"
  | "screening"
  | "unknown";

export type RepeatableGroupType = "experience" | "education" | "certification" | "language" | "reference";

export type RepeatableGroupHint = {
  id: string;
  type: RepeatableGroupType;
  index: number;
  confidence: number;
};

export type FieldCandidate = {
  id: string;
  element: HTMLElement;
  controlType:
    | "text"
    | "textarea"
    | "email"
    | "phone"
    | "number"
    | "date"
    | "select"
    | "combobox"
    | "radioGroup"
    | "checkbox"
    | "checkboxGroup"
    | "file"
    | "contenteditable"
    | "unknown";
  dom: {
    tagName: string;
    type?: string;
    id?: string;
    name?: string;
    className?: string;
    role?: string;
    autocomplete?: string;
    placeholder?: string;
    selector?: string;
  };
  accessibility: {
    label?: string;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    describedBy?: string;
    required?: boolean;
  };
  context: {
    nearbyText: string[];
    previousText: string[];
    nextText: string[];
    sectionTitle?: string;
    sectionType?: SectionType;
    formTitle?: string;
    pageTitle?: string;
    buttonTextsNearby?: string[];
    repeatableGroup?: RepeatableGroupHint;
  };
  options?: FieldOption[];
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
  };
  state: {
    disabled: boolean;
    readonly: boolean;
    empty: boolean;
    currentValue?: string;
  };
};

export type SerializableFieldCandidate = Omit<FieldCandidate, "element">;

export type FieldMatch = {
  candidateId: string;
  canonicalKey: CanonicalFieldKey;
  confidence: number;
  evidence: MatchEvidence[];
  adapterId: string;
  fillable: boolean;
  requiresReview: boolean;
  node: SerializableFieldCandidate;
};

export type SavedFieldOverride = {
  id: string;
  canonicalKey: CanonicalFieldKey;
  elementSelector?: string;
  label?: string;
  fieldSignature?: FieldSignature;
  createdAt: string;
  updatedAt: string;
};

export type SiteMappingOverride = {
  id: string;
  hostname: string;
  adapterId: string;
  fields: SavedFieldOverride[];
  createdAt: string;
  updatedAt: string;
};

export type FillOptions = {
  includeReviewFields?: boolean;
  excludedCandidateIds?: string[];
  siteOverride?: SiteMappingOverride | null;
  localMappingOverrides?: LocalMappingOverride[];
  siteRecipes?: SiteRecipe[];
};

export type ExecutionMode = "conservative" | "assisted" | "recorder";

export type FillWarning = {
  code: string;
  message: string;
  candidateId?: string;
};

export type FillStep =
  | {
      type: "setText";
      target: ElementTarget;
      canonicalKey: CanonicalFieldKey;
      value: string;
      confidence: number;
      requiresReview: boolean;
    }
  | {
      type: "selectOption";
      target: ElementTarget;
      canonicalKey: CanonicalFieldKey;
      value: string;
      optionMatchStrategy: "exact" | "normalized" | "fuzzy";
      confidence: number;
      requiresReview: boolean;
    }
  | {
      type: "clickCheckbox";
      target: ElementTarget;
      canonicalKey: CanonicalFieldKey;
      checked: boolean;
      confidence: number;
      requiresReview: boolean;
    }
  | {
      type: "uploadFile";
      target: ElementTarget;
      documentId: string;
      confidence: number;
      requiresUserAction: true;
      requiresReview: true;
    }
  | {
      type: "manual";
      target: ElementTarget;
      canonicalKey?: CanonicalFieldKey;
      reason: string;
      requiresReview: true;
    };

export type FillPlan = {
  id: string;
  adapterId: string;
  url: string;
  createdAt: string;
  profileId: string;
  detectedPlatform: string;
  steps: FillStep[];
  warnings: FillWarning[];
};

export type StepDiagnostic = {
  candidateId: string;
  label: string;
  canonicalKey?: CanonicalFieldKey;
  confidence?: number;
  status: "auto" | "review" | "upload" | "manual" | "skipped";
  action: FillStep["type"];
  evidence: MatchEvidence[];
  sectionType?: SectionType;
  sectionTitle?: string;
  repeatableGroup?: RepeatableGroupHint;
  driver: "nativeText" | "nativeSelect" | "checkbox" | "manual" | "upload";
};

export type ParserDiagnostics = {
  scannedElements: number;
  candidateFields: number;
  sectionsDetected: number;
  repeatableGroupsDetected: number;
  ignoredHiddenElements: number;
  highConfidenceMatches: number;
  reviewRequiredMatches: number;
  manualSteps: number;
  skippedFields: number;
  adapterId: string;
  parserVersion: string;
  warnings: string[];
};

export type FillPlanDiagnostics = {
  parser: ParserDiagnostics;
  steps: StepDiagnostic[];
  pageActions?: PageAction[];
  appliedOverrideIds?: string[];
  appliedRecipeIds?: string[];
};

export type InspectionResult = {
  url: string;
  platform: PlatformDetection;
  fields: SerializableFieldCandidate[];
  matches: FieldMatch[];
  plan: FillPlan;
  diagnostics: FillPlanDiagnostics;
  executionMode: ExecutionMode;
  acceptedCandidateIds: string[];
  options?: FillOptions;
};

export type FieldSignature = {
  labelText?: string;
  ariaLabel?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  inputType?: string;
  sectionTitle?: string;
  nearbyTextHash?: string;
  domPathHint?: string;
};

export type LocalMappingOverride = {
  id: string;
  hostname: string;
  adapterId: string;
  urlPattern?: string;
  fieldSignature: FieldSignature;
  canonicalKey: CanonicalFieldKey;
  confidenceBoost: number;
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
};

export type PageActionType =
  | "addExperience"
  | "addEducation"
  | "addCertification"
  | "nextStep"
  | "uploadResume"
  | "uploadCoverLetter"
  | "unknown";

export type PageAction = {
  id: string;
  type: PageActionType;
  label: string;
  selector: string;
  confidence: number;
};

export type RecipeFieldSelector = {
  selector: string;
  strategy: "css";
  confidence?: number;
};

export type RecipeActionSelector = {
  selector: string;
  strategy: "css";
  label?: string;
  confidence?: number;
};

export type SiteRecipe = {
  id: string;
  label: string;
  hostnamePattern: string;
  fields: Partial<Record<CanonicalFieldKey, RecipeFieldSelector[]>>;
  actions?: Partial<Record<PageActionType, RecipeActionSelector[]>>;
  semanticHints?: Record<string, unknown>;
  parserHints?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type AutofillErrorCode =
  | "ADAPTER_NOT_FOUND"
  | "PROFILE_NOT_SELECTED"
  | "FIELD_NOT_VISIBLE"
  | "FIELD_DISABLED"
  | "VALUE_NOT_FOUND"
  | "OPTION_NOT_FOUND"
  | "UPLOAD_REQUIRES_USER_ACTION"
  | "PERMISSION_MISSING"
  | "PLATFORM_RESTRICTED"
  | "UNKNOWN";

export type AutofillError = {
  code: AutofillErrorCode;
  message: string;
  candidateId?: string;
};

export type FillResult = {
  fillPlanId: string;
  status: "success" | "partial" | "failed";
  completedSteps: number;
  skippedSteps: number;
  manualSteps: number;
  errors: AutofillError[];
};

export type PlatformDetection = {
  adapterId: string;
  label: string;
  confidence: number;
  restricted?: boolean;
  copyOnly?: boolean;
  pageState?: string;
  stepKind?: string;
};

export type EncryptionStatus = {
  configured: boolean;
  unlocked: boolean;
  hasLegacyProfiles: boolean;
  encryptedProfileCount: number;
  legacyProfileCount: number;
  selectedProfileId?: string;
  selectedProfileLabel?: string;
};

export type ProfileSummary = {
  profileId: string;
  label: string;
  updatedAt: string;
  selected: boolean;
};

export type ProfileVariantOverrides = {
  links?: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    website?: string;
  };
  skills?: string[];
  workExperienceDescription?: string;
  remotePreference?: "remote" | "hybrid" | "onsite" | "flexible";
  willingToRelocate?: boolean;
  noticePeriod?: string;
  resumeDocumentId?: string;
  coverLetterDocumentId?: string;
};

export type ProfileVariant = {
  variantId: string;
  baseProfileId: string;
  label: string;
  targetRole?: string;
  overrides: ProfileVariantOverrides;
  createdAt: string;
  updatedAt: string;
};

export type ProfileVariantSummary = {
  variantId: string;
  baseProfileId: string;
  label: string;
  targetRole?: string;
  updatedAt: string;
  selected: boolean;
};

export type FirstRunConsentStatus = {
  accepted: boolean;
  acceptedAt?: string;
};

export type ActiveTabComplianceStatus = {
  url: string;
  platform: PlatformDetection;
  permissionState: "notRequired" | "granted" | "missing";
};
