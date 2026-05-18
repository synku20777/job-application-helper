import type { CanonicalFieldKey } from "@job-helper/shared";
import { resolveEffectiveSynonyms } from "./labelDictionaries";

export const fieldSynonyms: Record<CanonicalFieldKey, string[]> = resolveEffectiveSynonyms();

export const sensitiveFields = new Set<CanonicalFieldKey>([
  "demographics.gender",
  "demographics.pronouns",
  "applicationDefaults.sponsorshipRequiredDefault"
]);

export function isSensitiveField(key: CanonicalFieldKey): boolean {
  return sensitiveFields.has(key);
}
