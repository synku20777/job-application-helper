import type { CanonicalFieldKey, FieldMatch, FieldSignature, LocalMappingOverride, SerializableFieldCandidate } from "@job-helper/shared";
import { isSensitiveField } from "./fieldOntology";
import { fieldDisplayLabel } from "./fillPlan";
import { normalizeText } from "./normalize";

function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export function buildFieldSignature(field: SerializableFieldCandidate): FieldSignature {
  return {
    labelText: fieldDisplayLabel(field),
    ariaLabel: field.accessibility.ariaLabel,
    placeholder: field.dom.placeholder,
    name: field.dom.name,
    id: field.dom.id,
    inputType: field.dom.type ?? field.controlType,
    sectionTitle: field.context.sectionTitle,
    nearbyTextHash: stableHash([...field.context.previousText, ...field.context.nextText, ...field.context.nearbyText].join(" ")),
    domPathHint: field.dom.selector
  };
}

function sameNormalized(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right) && normalizeText(left) === normalizeText(right);
}

export function matchLocalMappingOverride(field: SerializableFieldCandidate, override: LocalMappingOverride): number {
  const signature = buildFieldSignature(field);
  let score = 0;
  if (sameNormalized(signature.labelText, override.fieldSignature.labelText)) score += 0.4;
  if (sameNormalized(signature.name, override.fieldSignature.name)) score += 0.25;
  if (sameNormalized(signature.sectionTitle, override.fieldSignature.sectionTitle)) score += 0.2;
  if (sameNormalized(signature.placeholder, override.fieldSignature.placeholder)) score += 0.15;
  if (sameNormalized(signature.ariaLabel, override.fieldSignature.ariaLabel)) score += 0.15;
  if (signature.nearbyTextHash && signature.nearbyTextHash === override.fieldSignature.nearbyTextHash) score += 0.1;
  if (signature.domPathHint && signature.domPathHint === override.fieldSignature.domPathHint) score += 0.2;
  return Math.min(1, score + Math.max(0, override.confidenceBoost));
}

export function localOverrideToMatch(
  field: SerializableFieldCandidate,
  override: LocalMappingOverride,
  adapterId: string,
  confidence: number
): FieldMatch {
  return {
    candidateId: field.id,
    canonicalKey: override.canonicalKey,
    confidence,
    evidence: [{ type: "userOverride", text: override.fieldSignature.labelText ?? override.fieldSignature.name ?? override.canonicalKey, weight: 1 }],
    adapterId,
    fillable: field.geometry.visible && !field.state.disabled,
    requiresReview: isSensitiveField(override.canonicalKey),
    node: field
  };
}

export function matchFieldsWithLocalOverrides<T extends SerializableFieldCandidate>(
  fields: T[],
  adapterId: string,
  overrides: LocalMappingOverride[] = [],
  minScore = 0.7
): { overrideMatches: FieldMatch[]; remainingFields: T[]; appliedOverrideIds: string[] } {
  const matchedIds = new Set<string>();
  const appliedOverrideIds: string[] = [];
  const overrideMatches: FieldMatch[] = [];

  for (const field of fields) {
    const best = overrides
      .filter((override) => override.adapterId === adapterId)
      .map((override) => ({ override, score: matchLocalMappingOverride(field, override) }))
      .filter((candidate) => candidate.score >= minScore)
      .sort((a, b) => b.score - a.score)[0];

    if (!best) continue;
    matchedIds.add(field.id);
    appliedOverrideIds.push(best.override.id);
    overrideMatches.push(localOverrideToMatch(field, best.override, adapterId, best.score));
  }

  return {
    overrideMatches,
    remainingFields: fields.filter((field) => !matchedIds.has(field.id)),
    appliedOverrideIds
  };
}

export function createLocalMappingOverride(input: {
  hostname: string;
  adapterId: string;
  field: SerializableFieldCandidate;
  canonicalKey: CanonicalFieldKey;
  urlPattern?: string;
}): Omit<LocalMappingOverride, "id" | "createdAt" | "lastUsedAt" | "useCount"> {
  return {
    hostname: input.hostname.toLowerCase(),
    adapterId: input.adapterId,
    urlPattern: input.urlPattern,
    fieldSignature: buildFieldSignature(input.field),
    canonicalKey: input.canonicalKey,
    confidenceBoost: 0.1
  };
}
