import { escapeCssIdentifier } from "./selectors";

export function compactText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function getAssociatedLabel(element: HTMLElement): string | undefined {
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    const label = element.labels?.[0]?.textContent;
    if (compactText(label)) return compactText(label);
  }

  const id = element.getAttribute("id");
  if (id) {
    const explicit = document.querySelector(`label[for="${escapeCssIdentifier(id)}"]`);
    if (compactText(explicit?.textContent)) return compactText(explicit?.textContent);
  }

  const wrappingLabel = element.closest("label");
  if (compactText(wrappingLabel?.textContent)) return compactText(wrappingLabel?.textContent);

  return undefined;
}

export function getAriaLabelledByText(element: HTMLElement): string | undefined {
  const ids = element.getAttribute("aria-labelledby");
  if (!ids) return undefined;

  const text = ids
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent)
    .filter(Boolean)
    .join(" ");

  return compactText(text) || undefined;
}

export function getNearbyText(element: HTMLElement): string[] {
  const texts = new Set<string>();
  let current: Element | null = element.parentElement;

  for (let depth = 0; current && depth < 3; depth += 1) {
    for (const candidate of Array.from(current.children)) {
      if (candidate === element || candidate.contains(element)) continue;
      const text = compactText(candidate.textContent);
      if (text && text.length <= 160) texts.add(text);
    }
    current = current.parentElement;
  }

  return Array.from(texts).slice(0, 8);
}

export function getSectionHeading(element: HTMLElement): string | undefined {
  let current: HTMLElement | null = element.parentElement;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const heading = current.querySelector("h1,h2,h3,h4,legend,[role='heading']");
    if (heading && !heading.contains(element)) {
      const text = compactText(heading.textContent);
      if (text) return text;
    }
    current = current.parentElement;
  }

  return undefined;
}
