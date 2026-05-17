import type { FieldMatch, FormFieldNode, MatchEvidence } from "@job-helper/shared";
import { confidenceWeights } from "./confidence";
import { fieldSynonyms, isSensitiveField } from "./fieldOntology";
import { includesNormalized, normalizeText } from "./normalize";

function evidence(type: MatchEvidence["type"], text: string): MatchEvidence {
  return { type, text, weight: confidenceWeights[type] };
}

function nodeText(node: FormFieldNode): string[] {
  return [
    node.associatedLabelText,
    node.ariaLabel,
    node.ariaLabelledByText,
    node.name,
    node.id,
    node.placeholder,
    node.sectionHeading,
    node.formHeading,
    ...node.nearbyText,
    ...(node.options ?? [])
  ].filter(Boolean) as string[];
}

function bestEvidenceForSynonym(node: FormFieldNode, synonym: string): MatchEvidence | undefined {
  if (includesNormalized(node.associatedLabelText, synonym)) return evidence("labelExactMatch", node.associatedLabelText ?? "");
  if (includesNormalized(node.ariaLabel, synonym) || includesNormalized(node.ariaLabelledByText, synonym)) {
    return evidence("ariaExactMatch", node.ariaLabel ?? node.ariaLabelledByText ?? "");
  }
  if (includesNormalized(node.name, synonym) || includesNormalized(node.id, synonym)) {
    return evidence("nameAttributeMatch", node.name ?? node.id ?? "");
  }
  if (includesNormalized(node.placeholder, synonym)) return evidence("placeholderMatch", node.placeholder ?? "");
  if (node.nearbyText.some((text) => includesNormalized(text, synonym))) {
    return evidence("nearbyTextMatch", node.nearbyText.join(" "));
  }
  if (includesNormalized(node.sectionHeading, synonym) || includesNormalized(node.formHeading, synonym)) {
    return evidence("sectionContextMatch", node.sectionHeading ?? node.formHeading ?? "");
  }

  const allText = normalizeText(nodeText(node).join(" "));
  const words = normalizeText(synonym).split(" ").filter(Boolean);
  if (words.length > 1 && words.every((word) => allText.includes(word))) {
    return evidence("fuzzyMatch", allText);
  }

  return undefined;
}

export function matchField(node: FormFieldNode, adapterId = "generic-html-form"): FieldMatch | undefined {
  let best: FieldMatch | undefined;

  for (const [canonicalKey, synonyms] of Object.entries(fieldSynonyms)) {
    const evidences = synonyms
      .map((synonym) => bestEvidenceForSynonym(node, synonym))
      .filter(Boolean) as MatchEvidence[];

    if (evidences.length === 0) continue;

    const sorted = evidences.sort((a, b) => b.weight - a.weight);
    const confidence = sorted[0]?.weight ?? 0;
    const requiresReview = isSensitiveField(canonicalKey as FieldMatch["canonicalKey"]) || confidence < 0.9;

    const candidate: FieldMatch = {
      elementId: node.elementId,
      canonicalKey: canonicalKey as FieldMatch["canonicalKey"],
      confidence,
      evidence: sorted.slice(0, 3),
      adapterId,
      fillable: node.visible && !node.disabled && confidence >= 0.7,
      requiresReview,
      node
    };

    if (!best || candidate.confidence > best.confidence) best = candidate;
  }

  return best;
}

export function matchFields(nodes: FormFieldNode[], adapterId = "generic-html-form"): FieldMatch[] {
  return nodes
    .map((node) => matchField(node, adapterId))
    .filter((match): match is FieldMatch => Boolean(match))
    .sort((a, b) => b.confidence - a.confidence);
}
