import type { CanonicalFieldKey, FieldMatch, MatchEvidence, SerializableFieldCandidate } from "@job-helper/shared";
import { confidencePolicy, confidenceWeights } from "./confidence";
import {
  canonicalFieldOntology,
  type CanonicalFieldDefinition,
  type CanonicalFieldOntology
} from "./fieldOntology";
import { resolveEffectiveSynonyms } from "./labelDictionaries";
import { includesNormalized, normalizeText } from "./normalize";

export type MatchLocaleOptions = {
  locales?: string[];
};

export type ClassificationContext = MatchLocaleOptions & {
  adapterId?: string;
  ontology?: CanonicalFieldOntology;
};

export type SemanticFieldMatch = FieldMatch & {
  sensitive: boolean;
};

function evidence(type: MatchEvidence["type"], text: string, weight = confidenceWeights[type]): MatchEvidence {
  return { type, text, weight };
}

function allCandidateText(node: SerializableFieldCandidate): string[] {
  return [
    node.accessibility.label,
    node.accessibility.ariaLabel,
    node.accessibility.ariaLabelledBy,
    node.accessibility.describedBy,
    node.dom.name,
    node.dom.id,
    node.dom.autocomplete,
    node.dom.placeholder,
    node.context.sectionTitle,
    node.context.formTitle,
    node.context.pageTitle,
    ...node.context.previousText,
    ...node.context.nextText,
    ...node.context.nearbyText,
    ...(node.context.buttonTextsNearby ?? []),
    ...(node.options?.map((option) => option.label) ?? [])
  ].filter((text): text is string => Boolean(text));
}

function labelsForDefinition(
  canonicalKey: CanonicalFieldKey,
  definition: CanonicalFieldDefinition,
  context: ClassificationContext
): string[] {
  if (!context.locales?.length) return definition.labels;
  return Array.from(new Set([...definition.labels, ...(resolveEffectiveSynonyms(context.locales)[canonicalKey] ?? [])]));
}

function anyIncludes(source: string | undefined, values: string[]): string | undefined {
  return values.find((value) => includesNormalized(source, value));
}

function autocompleteMatch(node: SerializableFieldCandidate, definition: CanonicalFieldDefinition): string | undefined {
  const autocomplete = normalizeText(node.dom.autocomplete);
  if (!autocomplete) return undefined;
  return definition.autocomplete?.find((candidate) => autocomplete === normalizeText(candidate));
}

function sectionContextMatch(node: SerializableFieldCandidate, definition: CanonicalFieldDefinition, labels: string[]): string | undefined {
  if (node.context.sectionType && definition.sectionTypes?.includes(node.context.sectionType)) return node.context.sectionType;
  return anyIncludes([node.context.sectionTitle, node.context.formTitle].filter(Boolean).join(" "), labels);
}

function negativeLabelMatch(node: SerializableFieldCandidate, definition: CanonicalFieldDefinition): string | undefined {
  const negativeLabels = definition.negativeLabels ?? [];
  if (negativeLabels.length === 0) return undefined;
  return anyIncludes(allCandidateText(node).join(" "), negativeLabels);
}

function fuzzyMatch(node: SerializableFieldCandidate, labels: string[]): string | undefined {
  const text = normalizeText(allCandidateText(node).join(" "));
  return labels.find((label) => {
    const words = normalizeText(label).split(" ").filter(Boolean);
    return words.length > 1 && words.every((word) => text.includes(word));
  });
}

export function scoreCandidateMatch(
  candidate: SerializableFieldCandidate,
  canonicalKey: CanonicalFieldKey,
  definition: CanonicalFieldDefinition,
  context: ClassificationContext = {}
): SemanticFieldMatch {
  const labels = labelsForDefinition(canonicalKey, definition, context);
  const evidenceList: MatchEvidence[] = [];
  let score = 0;

  const labelMatch = anyIncludes(candidate.accessibility.label, labels);
  if (labelMatch) {
    score += confidenceWeights.exactLabel;
    evidenceList.push(evidence("exactLabel", candidate.accessibility.label ?? labelMatch));
  }

  const ariaMatch = anyIncludes([candidate.accessibility.ariaLabel, candidate.accessibility.ariaLabelledBy].filter(Boolean).join(" "), labels);
  if (ariaMatch) {
    score += confidenceWeights.ariaLabel;
    evidenceList.push(evidence("ariaLabel", candidate.accessibility.ariaLabel ?? candidate.accessibility.ariaLabelledBy ?? ariaMatch));
  }

  const autocomplete = autocompleteMatch(candidate, definition);
  if (autocomplete) {
    score += confidenceWeights.autocomplete;
    evidenceList.push(evidence("autocomplete", candidate.dom.autocomplete ?? autocomplete));
  }

  const nameOrId = anyIncludes([candidate.dom.name, candidate.dom.id].filter(Boolean).join(" "), labels);
  if (nameOrId) {
    score += confidenceWeights.nameOrId;
    evidenceList.push(evidence("nameOrId", candidate.dom.name ?? candidate.dom.id ?? nameOrId));
  }

  const placeholder = anyIncludes(candidate.dom.placeholder, labels);
  if (placeholder) {
    score += confidenceWeights.placeholder;
    evidenceList.push(evidence("placeholder", candidate.dom.placeholder ?? placeholder));
  }

  const section = sectionContextMatch(candidate, definition, labels);
  if (section) {
    score += confidenceWeights.sectionContext;
    evidenceList.push(evidence("sectionContext", section));
  }

  const nearby = anyIncludes([...candidate.context.previousText, ...candidate.context.nextText, ...candidate.context.nearbyText].join(" "), labels);
  if (nearby) {
    score += confidenceWeights.nearbyText;
    evidenceList.push(evidence("nearbyText", nearby));
  }

  if (evidenceList.length === 0) {
    const fuzzy = fuzzyMatch(candidate, labels);
    if (fuzzy) {
      score += confidenceWeights.fuzzyMatch;
      evidenceList.push(evidence("fuzzyMatch", fuzzy));
    }
  }

  const negative = negativeLabelMatch(candidate, definition);
  if (negative) {
    score += confidenceWeights.negativeLabel;
    evidenceList.push(evidence("negativeLabel", negative));
  }

  const confidence = Math.max(0, Math.min(1, score));
  const sensitive = definition.sensitivity === "sensitive";

  return {
    candidateId: candidate.id,
    canonicalKey,
    confidence,
    evidence: evidenceList.sort((a, b) => b.weight - a.weight).slice(0, 4),
    adapterId: context.adapterId ?? "generic-html-form",
    fillable: candidate.geometry.visible && !candidate.state.disabled && confidence >= confidencePolicy.review,
    requiresReview: confidence < confidencePolicy.autoFill || sensitive,
    sensitive,
    node: candidate
  };
}

function selectBestMatches(matches: SemanticFieldMatch[]): SemanticFieldMatch[] {
  const best = matches.sort((a, b) => b.confidence - a.confidence)[0];
  return best ? [best] : [];
}

export function classifyFields<T extends SerializableFieldCandidate>(
  candidates: T[],
  ontology: CanonicalFieldOntology = canonicalFieldOntology,
  context: ClassificationContext = {}
): SemanticFieldMatch[] {
  return candidates.flatMap((candidate) => {
    const matches = (Object.entries(ontology) as Array<[CanonicalFieldKey, CanonicalFieldDefinition]>)
      .map(([canonicalKey, definition]) => scoreCandidateMatch(candidate, canonicalKey, definition, context))
      .filter((match) => match.confidence >= confidencePolicy.review);

    return selectBestMatches(matches);
  });
}

export function matchField(
  node: SerializableFieldCandidate,
  adapterId = "generic-html-form",
  options: MatchLocaleOptions = {}
): FieldMatch | undefined {
  return classifyFields([node], canonicalFieldOntology, { ...options, adapterId })[0];
}

export function matchFields<T extends SerializableFieldCandidate>(
  nodes: T[],
  adapterId = "generic-html-form",
  options: MatchLocaleOptions = {}
): FieldMatch[] {
  return classifyFields(nodes, canonicalFieldOntology, { ...options, adapterId }).sort((a, b) => b.confidence - a.confidence);
}
