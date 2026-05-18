export function normalizeText(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
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
