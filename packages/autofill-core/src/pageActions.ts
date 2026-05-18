import type { PageAction, PageActionType } from "@job-helper/shared";
import { normalizeText } from "./normalize";

const actionPatterns: Array<{ type: PageActionType; patterns: RegExp[]; confidence: number }> = [
  { type: "addExperience", patterns: [/\badd (work )?(experience|employment)\b/i], confidence: 0.95 },
  { type: "addEducation", patterns: [/\badd (education|school)\b/i], confidence: 0.95 },
  { type: "addCertification", patterns: [/\badd cert/i], confidence: 0.9 },
  { type: "uploadResume", patterns: [/\b(upload|attach).*(resume|cv)\b/i, /\b(resume|cv).*(upload|attach)\b/i], confidence: 0.9 },
  { type: "uploadCoverLetter", patterns: [/\b(upload|attach).*cover letter\b/i, /\bcover letter.*(upload|attach)\b/i], confidence: 0.9 },
  { type: "nextStep", patterns: [/\bnext\b/i, /\bcontinue\b/i, /\bsave and continue\b/i], confidence: 0.8 }
];

function elementText(element: Element): string {
  return [
    element.textContent,
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("value")
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function actionTypeFor(label: string): { type: PageActionType; confidence: number } {
  const match = actionPatterns.find((candidate) => candidate.patterns.some((pattern) => pattern.test(label)));
  return match ? { type: match.type, confidence: match.confidence } : { type: "unknown", confidence: 0.4 };
}

function selectorFor(element: Element, index: number): string {
  const escape = globalThis.CSS?.escape ?? ((value: string) => value.replace(/["\\#.[\]:]/g, "\\$&"));
  const id = element.getAttribute("id");
  if (id) return `#${escape(id)}`;
  const name = element.getAttribute("name");
  if (name) return `${element.tagName.toLowerCase()}[name="${escape(name)}"]`;
  return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
}

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

export function detectPageActions(document: Document): PageAction[] {
  const elements = Array.from(
    document.querySelectorAll("button, input[type='button'], input[type='submit'], input[type='file'], [role='button'], a")
  ).filter(isVisible);

  return elements
    .map((element, index) => {
      const label = elementText(element);
      if (!normalizeText(label)) return undefined;
      const { type, confidence } = actionTypeFor(label);
      if (type === "unknown" && confidence < 0.5) return undefined;
      return {
        id: `action-${index}-${normalizeText(label).replace(/\s+/g, "-")}`,
        type,
        label,
        selector: selectorFor(element, index),
        confidence
      };
    })
    .filter((action): action is PageAction => Boolean(action));
}
