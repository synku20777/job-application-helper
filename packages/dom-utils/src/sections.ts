import type { SectionType } from "@job-helper/shared";
import { compactText } from "./labels";

function normalize(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyText(text: string): SectionType {
  if (/\b(resume|cv|curriculum vitae|cover letter|document|upload|lebenslauf|anschreiben)\b/.test(text)) return "documents";
  if (/\b(work experience|employment history|experience|company|employer|job title|berufserfahrung|arbeitgeber)\b/.test(text)) {
    return "experience";
  }
  if (/\b(education|school|university|college|degree|ausbildung|hochschule|abschluss)\b/.test(text)) return "education";
  if (/\b(skill|skills|competenc|technolog|kenntnisse|fahigkeiten|kompetenzen)\b/.test(text)) return "skills";
  if (/\b(gender|sex|pronoun|veteran|disability|ethnicity|race|demographic|geschlecht)\b/.test(text)) return "demographics";
  if (/\b(question|screening|disclosure|authorization|sponsorship|criminal|conviction|frage|arbeitserlaubnis)\b/.test(text)) {
    return "screening";
  }
  if (/\b(personal|contact|name|email|phone|address|my information|kontakt|personliche|personliche daten|adresse)\b/.test(text)) {
    return "personal";
  }

  return "unknown";
}

export function classifySectionType(...signals: Array<string | undefined>): SectionType {
  for (const signal of signals) {
    const sectionType = classifyText(normalize(signal));
    if (sectionType !== "unknown") return sectionType;
  }

  return classifyText(normalize(signals.filter(Boolean).join(" ")));
}

export function getProminentSectionText(element: HTMLElement): string | undefined {
  let current: HTMLElement | null = element.parentElement;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const prominent = Array.from(current.querySelectorAll<HTMLElement>("[aria-expanded], summary, strong, b, .accordion-header, .section-header"))
      .find((candidate) => !candidate.contains(element) && compactText(candidate.textContent).length > 0);
    const text = compactText(prominent?.textContent);
    if (text) return text;
    current = current.parentElement;
  }

  return undefined;
}
