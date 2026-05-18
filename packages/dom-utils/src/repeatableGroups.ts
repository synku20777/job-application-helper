import type { FieldCandidate, RepeatableGroupHint, RepeatableGroupType, SectionType } from "@job-helper/shared";
import { compactText } from "./labels";

export type RepeatableGroup = {
  id: string;
  type: RepeatableGroupType;
  container: HTMLElement;
  fields: FieldCandidate[];
  index: number;
  addButton?: HTMLElement;
  removeButton?: HTMLElement;
  confidence: number;
};

const sectionToRepeatableType: Partial<Record<SectionType, RepeatableGroupType>> = {
  experience: "experience",
  education: "education"
};

function normalize(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function groupTypeFromText(text: string): RepeatableGroupType | undefined {
  const normalized = normalize(text);
  if (/\b(experience|employment|company|employer|job title)\b/.test(normalized)) return "experience";
  if (/\b(education|school|university|college|degree)\b/.test(normalized)) return "education";
  if (/\b(certification|certificate|license)\b/.test(normalized)) return "certification";
  if (/\b(language)\b/.test(normalized)) return "language";
  if (/\b(reference)\b/.test(normalized)) return "reference";
  return undefined;
}

function closestGroupContainer(candidate: FieldCandidate): HTMLElement | undefined {
  return (
    candidate.element.closest<HTMLElement>("[data-repeatable-group], fieldset, section, article, form") ??
    candidate.element.parentElement ??
    undefined
  );
}

function buttonByText(container: HTMLElement, pattern: RegExp): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>("button, [role='button'], a"))
    .find((button) => pattern.test(compactText(button.textContent)));
}

function candidateGroupType(candidate: FieldCandidate, container: HTMLElement): RepeatableGroupType | undefined {
  const fromSection = candidate.context.sectionType ? sectionToRepeatableType[candidate.context.sectionType] : undefined;
  if (fromSection) return fromSection;
  return groupTypeFromText(
    [
      candidate.context.sectionTitle,
      candidate.context.formTitle,
      candidate.accessibility.label,
      candidate.dom.name,
      candidate.dom.id,
      compactText(container.textContent)
    ].filter(Boolean).join(" ")
  );
}

export function detectRepeatableGroups(candidates: FieldCandidate[]): RepeatableGroup[] {
  const grouped = new Map<string, { type: RepeatableGroupType; container: HTMLElement; fields: FieldCandidate[] }>();

  for (const candidate of candidates) {
    const container = closestGroupContainer(candidate);
    if (!container) continue;
    const type = candidateGroupType(candidate, container);
    if (!type) continue;
    const id = container.dataset.jobAutofillGroupId || `repeatable-${type}-${grouped.size + 1}`;
    container.dataset.jobAutofillGroupId = id;

    const existing = grouped.get(id);
    if (existing) existing.fields.push(candidate);
    else grouped.set(id, { type, container, fields: [candidate] });
  }

  const indexesByType = new Map<RepeatableGroupType, number>();

  return Array.from(grouped.entries())
    .filter(([, group]) => group.fields.length >= 2)
    .map(([id, group]) => {
      const index = indexesByType.get(group.type) ?? 0;
      indexesByType.set(group.type, index + 1);

      return {
        id,
        type: group.type,
        container: group.container,
        fields: group.fields,
        index,
        addButton: buttonByText(group.container, /\b(add|another|new|hinzufugen|hinzufügen)\b/i),
        removeButton: buttonByText(group.container, /\b(remove|delete|clear|entfernen|loschen|löschen)\b/i),
        confidence: group.fields.length >= 4 ? 0.9 : 0.75
      };
    });
}

export function repeatableGroupHint(group: RepeatableGroup): RepeatableGroupHint {
  return {
    id: group.id,
    type: group.type,
    index: group.index,
    confidence: group.confidence
  };
}
