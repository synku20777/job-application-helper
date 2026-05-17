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
  elementId: string;
  selector: string;
  label: string;
};

export type FormFieldNode = {
  elementId: string;
  selector: string;
  tagName: string;
  inputType?: string;
  role?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  ariaLabelledByText?: string;
  associatedLabelText?: string;
  nearbyText: string[];
  sectionHeading?: string;
  formHeading?: string;
  options?: string[];
  required?: boolean;
  visible: boolean;
  disabled: boolean;
};

export type FieldMatch = {
  elementId: string;
  canonicalKey: CanonicalFieldKey;
  confidence: number;
  evidence: MatchEvidence[];
  adapterId: string;
  fillable: boolean;
  requiresReview: boolean;
  node: FormFieldNode;
};

export type SavedFieldOverride = {
  id: string;
  canonicalKey: CanonicalFieldKey;
  elementSelector?: string;
  label?: string;
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
  excludedElementIds?: string[];
  siteOverride?: SiteMappingOverride | null;
};

export type FillWarning = {
  code: string;
  message: string;
  elementId?: string;
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
  elementId?: string;
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
