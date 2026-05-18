import type { FieldOption } from "@job-helper/shared";
import { normalizeText } from "./normalize";

export type OptionMatchResult = {
  matched: boolean;
  option?: FieldOption;
  confidence: number;
  strategy: "exact" | "normalizedExact" | "synonym" | "contains" | "fuzzy" | "manual";
};

export const optionSynonyms: Record<string, string[]> = {
  prefer_not_to_say: [
    "prefer not to say",
    "i do not wish to answer",
    "decline to answer",
    "decline to self-identify",
    "choose not to disclose",
    "not disclosed"
  ],
  yes: ["yes", "true", "y", "ja"],
  no: ["no", "false", "n", "nein"],
  remote: ["remote", "work from home", "home office"],
  hybrid: ["hybrid", "part remote", "partially remote"],
  onsite: ["onsite", "on site", "office", "in office"]
};

function optionTexts(option: FieldOption): string[] {
  return [option.label, option.value].filter(Boolean);
}

function canonicalSynonymKey(value: string): string | undefined {
  const normalized = normalizeText(value);
  return Object.entries(optionSynonyms).find(([, synonyms]) =>
    synonyms.some((synonym) => {
      const normalizedSynonym = normalizeText(synonym);
      return normalizedSynonym === normalized || normalizedSynonym.includes(normalized) || normalized.includes(normalizedSynonym);
    })
  )?.[0];
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = new Set(normalizeText(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  const shared = Array.from(aTokens).filter((token) => bTokens.has(token)).length;
  return shared / Math.max(aTokens.size, bTokens.size);
}

export function matchOption(options: FieldOption[] | undefined, value: unknown): OptionMatchResult {
  const target = String(value ?? "").trim();
  if (!target || !options?.length) return { matched: false, confidence: 0, strategy: "manual" };

  for (const option of options) {
    if (option.value === target || option.label === target) return { matched: true, option, confidence: 1, strategy: "exact" };
  }

  const normalizedTarget = normalizeText(target);
  for (const option of options) {
    if (optionTexts(option).some((text) => normalizeText(text) === normalizedTarget)) {
      return { matched: true, option, confidence: 0.95, strategy: "normalizedExact" };
    }
  }

  const targetSynonymKey = canonicalSynonymKey(target);
  if (targetSynonymKey) {
    for (const option of options) {
      if (optionTexts(option).some((text) => canonicalSynonymKey(text) === targetSynonymKey)) {
        return { matched: true, option, confidence: 0.9, strategy: "synonym" };
      }
    }
  }

  for (const option of options) {
    if (optionTexts(option).some((text) => normalizeText(text).includes(normalizedTarget) || normalizedTarget.includes(normalizeText(text)))) {
      return { matched: true, option, confidence: 0.75, strategy: "contains" };
    }
  }

  const fuzzy = options
    .map((option) => ({ option, confidence: Math.max(...optionTexts(option).map((text) => tokenSimilarity(text, target))) }))
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (fuzzy && fuzzy.confidence >= 0.5) return { matched: true, option: fuzzy.option, confidence: fuzzy.confidence, strategy: "fuzzy" };
  return { matched: false, confidence: 0, strategy: "manual" };
}
