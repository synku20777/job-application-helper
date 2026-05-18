import type { CandidateProfile } from "@job-helper/profile-schema";
import type {
  FieldMatch,
  FillOptions,
  FillPlan,
  FillStep,
  SerializableFieldCandidate,
  PlatformDetection,
  SavedFieldOverride,
  SiteMappingOverride
} from "@job-helper/shared";
import { confidenceBucket } from "./confidence";
import { isSensitiveField } from "./fieldOntology";
import { matchFields } from "./matcher";
import { normalizeText } from "./normalize";
import { matchOption } from "./optionMatcher";
import { resolveProfileValue } from "./valueResolver";

export function fieldDisplayLabel(node: SerializableFieldCandidate): string {
  return node.accessibility.label ?? node.accessibility.ariaLabel ?? node.dom.placeholder ?? node.dom.name ?? node.dom.id ?? node.dom.tagName;
}

function overrideText(override: SavedFieldOverride): string {
  return override.label ?? override.elementSelector ?? override.canonicalKey;
}

function overrideMatchesField(override: SavedFieldOverride, field: SerializableFieldCandidate): boolean {
  if (override.elementSelector && override.elementSelector === field.dom.selector) return true;
  if (!override.label) return false;

  const overrideLabel = normalizeText(override.label);
  return Boolean(overrideLabel) && overrideLabel === normalizeText(fieldDisplayLabel(field));
}

export function matchFieldsWithOverrides<T extends SerializableFieldCandidate>(
  fields: T[],
  adapterId: string,
  siteOverride?: SiteMappingOverride | null
): { overrideMatches: FieldMatch[]; remainingFields: T[] } {
  if (!siteOverride || siteOverride.adapterId !== adapterId || siteOverride.fields.length === 0) {
    return { overrideMatches: [], remainingFields: fields };
  }

  const matchedElementIds = new Set<string>();
  const overrideMatches: FieldMatch[] = [];

  for (const field of fields) {
    const override = siteOverride.fields.find((candidate) => overrideMatchesField(candidate, field));
    if (!override) continue;

    matchedElementIds.add(field.id);
    overrideMatches.push({
      candidateId: field.id,
      canonicalKey: override.canonicalKey,
      confidence: 1,
      evidence: [{ type: "userOverride", text: overrideText(override), weight: 1 }],
      adapterId,
      fillable: field.geometry.visible && !field.state.disabled,
      requiresReview: isSensitiveField(override.canonicalKey),
      node: field
    });
  }

  return {
    overrideMatches,
    remainingFields: fields.filter((field) => !matchedElementIds.has(field.id))
  };
}

export function targetFromMatch(match: FieldMatch) {
  return {
    candidateId: match.candidateId,
    selector: match.node.dom.selector || "",
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

  if (match.node.dom.tagName === "select") {
    const optionMatch = matchOption(match.node.options, value);
    if (!optionMatch.matched || !optionMatch.option) {
      return {
        type: "manual",
        target,
        canonicalKey: match.canonicalKey,
        reason: "Select option needs manual review.",
        requiresReview: true
      };
    }

    return {
      type: "selectOption",
      target,
      canonicalKey: match.canonicalKey,
      value: optionMatch.option.value || optionMatch.option.label,
      optionMatchStrategy: optionMatch.strategy === "normalizedExact" || optionMatch.strategy === "synonym" || optionMatch.strategy === "contains"
        ? "normalized"
        : optionMatch.strategy === "fuzzy"
          ? "fuzzy"
          : "exact",
      confidence: Math.min(match.confidence, optionMatch.confidence),
      requiresReview: match.requiresReview || optionMatch.confidence < 0.9
    };
  }

  if (match.node.dom.type === "checkbox" || match.node.dom.type === "radio") {
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

  if (match.node.dom.type === "file") {
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
      candidateId: match.candidateId
    }));

  warnings.push(
    ...extraSteps.map((step) => ({
      code: step.type === "uploadFile" ? "UPLOAD_REQUIRES_USER_ACTION" : "MANUAL_FIELD",
      message: step.type === "uploadFile" ? "Document upload requires user action." : "Field requires manual review.",
      candidateId: step.target.candidateId
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

export function buildFillPlan<T extends SerializableFieldCandidate>(
  fields: T[],
  profile: CandidateProfile,
  platform: PlatformDetection,
  url = "about:blank",
  options: FillOptions = {}
): FillPlan {
  const { overrideMatches, remainingFields } = matchFieldsWithOverrides(fields, platform.adapterId, options.siteOverride);
  const matches = [...overrideMatches, ...matchFields(remainingFields, platform.adapterId, { locales: [profile.meta.locale] })];
  return buildFillPlanFromMatches(matches, profile, platform, url);
}
