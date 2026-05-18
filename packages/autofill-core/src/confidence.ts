import type { FieldEvidenceType } from "@job-helper/shared";

export const confidenceWeights: Record<FieldEvidenceType, number> = {
  exactAdapterSelector: 1,
  exactLabel: 0.9,
  ariaLabel: 0.4,
  autocomplete: 0.3,
  nameOrId: 0.25,
  placeholder: 0.18,
  nearbyText: 0.12,
  sectionContext: 0.15,
  negativeLabel: -0.5,
  labelExactMatch: 0.95,
  ariaExactMatch: 0.9,
  nameAttributeMatch: 0.85,
  placeholderMatch: 0.75,
  nearbyTextMatch: 0.6,
  sectionContextMatch: 0.45,
  fuzzyMatch: 0.35,
  userOverride: 1,
  sensitive: 0
};

export const confidencePolicy = {
  autoFill: 0.9,
  review: 0.7,
  ignore: 0,
  sensitiveAlwaysReview: true,
  maxAutoFillForUnknownPlatform: 0.95
};

export function confidenceBucket(confidence: number, requiresReview: boolean): "auto" | "review" | "skip" {
  if (requiresReview) return confidence >= 0.7 ? "review" : "skip";
  if (confidence >= 0.9) return "auto";
  if (confidence >= 0.7) return "review";
  return "skip";
}
