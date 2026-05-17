export function normalizeText(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function includesNormalized(source: string | undefined, candidate: string): boolean {
  const normalizedSource = normalizeText(source);
  const normalizedCandidate = normalizeText(candidate);
  return Boolean(normalizedCandidate) && normalizedSource.includes(normalizedCandidate);
}
