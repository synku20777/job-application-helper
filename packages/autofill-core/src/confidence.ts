import type { FieldEvidenceType } from "@job-helper/shared";

export const confidenceWeights: Record<FieldEvidenceType, number> = {
  exactAdapterSelector: 1,
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

export function confidenceBucket(confidence: number, requiresReview: boolean): "auto" | "review" | "skip" {
  if (requiresReview) return confidence >= 0.7 ? "review" : "skip";
  if (confidence >= 0.9) return "auto";
  if (confidence >= 0.7) return "review";
  return "skip";
}
