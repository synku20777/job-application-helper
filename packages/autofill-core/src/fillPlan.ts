import type { CandidateProfile } from "@job-helper/profile-schema";
import type {
  FieldMatch,
  FillOptions,
  FillPlan,
  FillStep,
  FormFieldNode,
  PlatformDetection,
  SavedFieldOverride,
  SiteMappingOverride
} from "@job-helper/shared";
import { confidenceBucket } from "./confidence";
import { isSensitiveField } from "./fieldOntology";
import { matchFields } from "./matcher";
import { normalizeText } from "./normalize";
import { resolveProfileValue } from "./valueResolver";

export function fieldDisplayLabel(node: FormFieldNode): string {
  return node.associatedLabelText ?? node.ariaLabel ?? node.placeholder ?? node.name ?? node.id ?? node.tagName;
}

function overrideText(override: SavedFieldOverride): string {
  return override.label ?? override.elementSelector ?? override.canonicalKey;
}

function overrideMatchesField(override: SavedFieldOverride, field: FormFieldNode): boolean {
  if (override.elementSelector && override.elementSelector === field.selector) return true;
  if (!override.label) return false;

  const overrideLabel = normalizeText(override.label);
  return Boolean(overrideLabel) && overrideLabel === normalizeText(fieldDisplayLabel(field));
}

export function matchFieldsWithOverrides(
  fields: FormFieldNode[],
  adapterId: string,
  siteOverride?: SiteMappingOverride | null
): { overrideMatches: FieldMatch[]; remainingFields: FormFieldNode[] } {
  if (!siteOverride || siteOverride.adapterId !== adapterId || siteOverride.fields.length === 0) {
    return { overrideMatches: [], remainingFields: fields };
  }

  const matchedElementIds = new Set<string>();
  const overrideMatches: FieldMatch[] = [];

  for (const field of fields) {
    const override = siteOverride.fields.find((candidate) => overrideMatchesField(candidate, field));
    if (!override) continue;

    matchedElementIds.add(field.elementId);
    overrideMatches.push({
      elementId: field.elementId,
      canonicalKey: override.canonicalKey,
      confidence: 1,
      evidence: [{ type: "userOverride", text: overrideText(override), weight: 1 }],
      adapterId,
      fillable: field.visible && !field.disabled,
      requiresReview: isSensitiveField(override.canonicalKey),
      node: field
    });
  }

  return {
    overrideMatches,
    remainingFields: fields.filter((field) => !matchedElementIds.has(field.elementId))
  };
}

export function targetFromMatch(match: FieldMatch) {
  return {
    elementId: match.elementId,
    selector: match.node.selector,
    label: fieldDisplayLabel(match.node) || match.canonicalKey
  };
}

export function stepFromMatch(match: FieldMatch, profile: CandidateProfile): FillStep {
  const value = resolveProfileValue(profile, match.canonicalKey);
  const target = targetFromMatch(match);

  if (match.canonicalKey === "documents.resume" || match.canonicalKey === "documents.coverLetter") {
    if (typeof value === "string" && value) {
      return {
        type: "uploadFile",
        target,
        documentId: value,
        confidence: match.confidence,
        requiresUserAction: true,
        requiresReview: true
      };
    }

    return {
      type: "manual",
      target,
      canonicalKey: match.canonicalKey,
      reason: "File upload requires user action.",
      requiresReview: true
    };
  }

  if (value === undefined || value === "") {
    return {
      type: "manual",
      target,
      canonicalKey: match.canonicalKey,
      reason: "No matching profile value.",
      requiresReview: true
    };
  }

  if (match.node.tagName === "select") {
    return {
      type: "selectOption",
      target,
      canonicalKey: match.canonicalKey,
      value: String(value),
      optionMatchStrategy: "normalized",
      confidence: match.confidence,
      requiresReview: match.requiresReview
    };
  }

  if (match.node.inputType === "checkbox" || match.node.inputType === "radio") {
    if (typeof value !== "boolean") {
      return {
        type: "manual",
        target,
        canonicalKey: match.canonicalKey,
        reason: "Boolean field needs manual review.",
        requiresReview: true
      };
    }
    return {
      type: "clickCheckbox",
      target,
      canonicalKey: match.canonicalKey,
      checked: value,
      confidence: match.confidence,
      requiresReview: match.requiresReview
    };
  }

  if (match.node.inputType === "file") {
    return {
      type: "manual",
      target,
      canonicalKey: match.canonicalKey,
      reason: "File upload requires user action.",
      requiresReview: true
    };
  }

  return {
    type: "setText",
    target,
    canonicalKey: match.canonicalKey,
    value: String(value),
    confidence: match.confidence,
    requiresReview: match.requiresReview
  };
}

export function buildFillPlanFromMatches(
  matches: FieldMatch[],
  profile: CandidateProfile,
  platform: PlatformDetection,
  url = "about:blank",
  extraSteps: FillStep[] = []
): FillPlan {
  const steps = matches
    .filter((match) => match.fillable && confidenceBucket(match.confidence, match.requiresReview) !== "skip")
    .map((match) => stepFromMatch(match, profile))
    .concat(extraSteps);

  const warnings = matches
    .filter((match) => confidenceBucket(match.confidence, match.requiresReview) === "review")
    .map((match) => ({
      code: "REVIEW_REQUIRED",
      message: `${match.canonicalKey} needs review before filling.`,
      elementId: match.elementId
    }));

  warnings.push(
    ...extraSteps.map((step) => ({
      code: step.type === "uploadFile" ? "UPLOAD_REQUIRES_USER_ACTION" : "MANUAL_FIELD",
      message: step.type === "uploadFile" ? "Document upload requires user action." : "Field requires manual review.",
      elementId: step.target.elementId
    }))
  );

  return {
    id: crypto.randomUUID?.() ?? `fill-plan-${Date.now()}`,
    adapterId: platform.adapterId,
    url,
    createdAt: new Date().toISOString(),
    profileId: profile.meta.profileId,
    detectedPlatform: platform.label,
    steps,
    warnings
  };
}

export function buildFillPlan(
  fields: FormFieldNode[],
  profile: CandidateProfile,
  platform: PlatformDetection,
  url = "about:blank",
  options: FillOptions = {}
): FillPlan {
  const { overrideMatches, remainingFields } = matchFieldsWithOverrides(fields, platform.adapterId, options.siteOverride);
  const matches = [...overrideMatches, ...matchFields(remainingFields, platform.adapterId, { locales: [profile.meta.locale] })];
  return buildFillPlanFromMatches(matches, profile, platform, url);
}
