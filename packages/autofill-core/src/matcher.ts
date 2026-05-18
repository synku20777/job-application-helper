import type { FieldMatch, SerializableFieldCandidate, MatchEvidence } from "@job-helper/shared";
import { confidenceWeights } from "./confidence";
import { fieldSynonyms, isSensitiveField } from "./fieldOntology";
import { resolveEffectiveSynonyms } from "./labelDictionaries";
import { includesNormalized, normalizeText } from "./normalize";

export type MatchLocaleOptions = {
  locales?: string[];
};

function evidence(type: MatchEvidence["type"], text: string): MatchEvidence {
  return { type, text, weight: confidenceWeights[type] };
}

function nodeText(node: SerializableFieldCandidate): string[] {
  return [
    node.accessibility.label,
    node.accessibility.ariaLabel,
    node.accessibility.ariaLabelledBy,
    node.dom.name,
    node.dom.id,
    node.dom.placeholder,
    node.context.sectionTitle,
    node.context.formTitle,
    ...node.context.nearbyText,
    ...(node.options?.map(opt => opt.label) ?? [])
  ].filter((text): text is string => Boolean(text));
}

function bestEvidenceForSynonym(node: SerializableFieldCandidate, synonym: string): MatchEvidence | undefined {
  if (includesNormalized(node.accessibility.label, synonym)) return evidence("labelExactMatch", node.accessibility.label ?? "");
  if (includesNormalized(node.accessibility.ariaLabel, synonym) || includesNormalized(node.accessibility.ariaLabelledBy, synonym)) {
    return evidence("ariaExactMatch", node.accessibility.ariaLabel ?? node.accessibility.ariaLabelledBy ?? "");
  }
  if (includesNormalized(node.dom.name, synonym) || includesNormalized(node.dom.id, synonym)) {
    return evidence("nameAttributeMatch", node.dom.name ?? node.dom.id ?? "");
  }
  if (includesNormalized(node.dom.placeholder, synonym)) return evidence("placeholderMatch", node.dom.placeholder ?? "");
  if (node.context.nearbyText.some((text: string) => includesNormalized(text, synonym))) {
    return evidence("nearbyTextMatch", node.context.nearbyText.join(" "));
  }
  if (includesNormalized(node.context.sectionTitle, synonym) || includesNormalized(node.context.formTitle, synonym)) {
    return evidence("sectionContextMatch", node.context.sectionTitle ?? node.context.formTitle ?? "");
  }

  const allText = normalizeText(nodeText(node).join(" "));
  const words = normalizeText(synonym).split(" ").filter(Boolean);
  if (words.length > 1 && words.every((word) => allText.includes(word))) {
    return evidence("fuzzyMatch", allText);
  }

  return undefined;
}

export function matchField(node: SerializableFieldCandidate, adapterId = "generic-html-form", options: MatchLocaleOptions = {}): FieldMatch | undefined {
  let best: FieldMatch | undefined;
  const synonymsByKey = options.locales?.length ? resolveEffectiveSynonyms(options.locales) : fieldSynonyms;

  for (const [canonicalKey, synonyms] of Object.entries(synonymsByKey)) {
    const evidences = synonyms
      .map((synonym) => bestEvidenceForSynonym(node, synonym))
      .filter(Boolean) as MatchEvidence[];

    if (evidences.length === 0) continue;

    const sorted = evidences.sort((a, b) => b.weight - a.weight);
    const confidence = sorted[0]?.weight ?? 0;
    const requiresReview = isSensitiveField(canonicalKey as FieldMatch["canonicalKey"]) || confidence < 0.9;

    const candidate: FieldMatch = {
      candidateId: node.id,
      canonicalKey: canonicalKey as FieldMatch["canonicalKey"],
      confidence,
      evidence: sorted.slice(0, 3),
      adapterId,
      fillable: node.geometry.visible && !node.state.disabled && confidence >= 0.7,
      requiresReview,
      node
    };

    if (!best || candidate.confidence > best.confidence) best = candidate;
  }

  return best;
}

export function matchFields<T extends SerializableFieldCandidate>(nodes: T[], adapterId = "generic-html-form", options: MatchLocaleOptions = {}): FieldMatch[] {
  return nodes
    .map((node) => matchField(node, adapterId, options))
    .filter((match): match is FieldMatch => Boolean(match))
    .sort((a, b) => b.confidence - a.confidence);
}
