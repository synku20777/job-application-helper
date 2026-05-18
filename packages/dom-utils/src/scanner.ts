import type { FieldCandidate, FieldOption, PlatformDetection } from "@job-helper/shared";
import {
  compactText,
  getAriaLabelledByText,
  getAssociatedLabel,
  getNearbyText,
  getNextText,
  getPreviousText,
  getSectionHeading
} from "./labels";
import { elementSelector, ensureElementId, isVisible, queryFillableElements } from "./inputs";
import { detectRepeatableGroups, repeatableGroupHint } from "./repeatableGroups";
import { FieldCandidateRegistry } from "./registry";
import { classifySectionType, getProminentSectionText } from "./sections";

function optionsFor(element: HTMLElement): FieldOption[] | undefined {
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.options).map((option) => ({
      label: compactText(option.textContent || option.value),
      value: option.value
    })).filter(opt => opt.label);
  }
  if (element.getAttribute("role") === "combobox") {
    return Array.from(element.ownerDocument.querySelectorAll<HTMLElement>("[role='option']")).map((option) => ({
      label: compactText(option.textContent),
      value: option.getAttribute("value") || option.getAttribute("data-value") || compactText(option.textContent)
    })).filter(opt => opt.label);
  }
  return undefined;
}

function formHeadingFor(element: HTMLElement): string | undefined {
  const form = element.closest("form");
  if (!form) return undefined;
  const heading = form.querySelector("h1,h2,h3,legend,[role='heading']");
  return compactText(heading?.textContent) || undefined;
}

function getControlType(element: HTMLElement): FieldCandidate["controlType"] {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "textarea") return "textarea";
  if (tagName === "select") return "select";
  if (element.getAttribute("role") === "combobox") return "combobox";
  if (element.getAttribute("role") === "checkbox" || (element instanceof HTMLInputElement && element.type === "checkbox")) return "checkbox";
  if (element.getAttribute("role") === "radio" || (element instanceof HTMLInputElement && element.type === "radio")) return "radioGroup";
  if (element.isContentEditable || element.getAttribute("contenteditable") === "true") return "contenteditable";
  if (element.getAttribute("role") === "textbox") return "text";
  
  if (element instanceof HTMLInputElement) {
    switch (element.type) {
      case "email": return "email";
      case "tel": return "phone";
      case "number": return "number";
      case "date": return "date";
      case "file": return "file";
      default: return "text";
    }
  }
  return "unknown";
}

function describedByText(element: HTMLElement): string | undefined {
  const ids = element.getAttribute("aria-describedby");
  if (!ids) return undefined;
  const text = ids
    .split(/\s+/)
    .map((id) => element.ownerDocument.getElementById(id)?.textContent)
    .filter(Boolean)
    .join(" ");
  return compactText(text) || undefined;
}

function buttonTextsNearby(element: HTMLElement): string[] {
  const container = element.closest("fieldset, section, article, form, div") ?? element.parentElement;
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>("button, [role='button'], a"))
    .map((button) => compactText(button.textContent))
    .filter(Boolean)
    .slice(0, 5);
}

function isDisabled(element: HTMLElement): boolean {
  return (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    ((element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement) &&
      element.disabled)
  );
}

function isReadonly(element: HTMLElement): boolean {
  return (
    element.hasAttribute("readonly") ||
    element.getAttribute("aria-readonly") === "true" ||
    ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.readOnly)
  );
}

export function scanFormFields(root: ParentNode = document): FieldCandidate[] {
  const registry = FieldCandidateRegistry.getInstance();
  
  const candidates = queryFillableElements(root).map((element) => {
    const candidateId = ensureElementId(element);
    registry.register(candidateId, element);
    
    const inputType = element instanceof HTMLInputElement ? element.type : undefined;
    const rect = element.getBoundingClientRect();
    const visible = isVisible(element);
    const disabled = isDisabled(element);
    const readonly = isReadonly(element);
    const label = getAssociatedLabel(element);
    const ariaLabel = element.getAttribute("aria-label") ?? undefined;
    const ariaLabelledBy = getAriaLabelledByText(element);
    const nearbyText = getNearbyText(element);
    const previousText = getPreviousText(element);
    const nextText = getNextText(element);
    const sectionTitle = getSectionHeading(element) ?? getProminentSectionText(element);
    const formTitle = formHeadingFor(element);

    return {
      id: candidateId,
      element,
      controlType: getControlType(element),
      dom: {
        tagName: element.tagName.toLowerCase(),
        type: inputType,
        id: element.getAttribute("id") ?? undefined,
        name: element.getAttribute("name") ?? undefined,
        className: element.className || undefined,
        role: element.getAttribute("role") ?? undefined,
        autocomplete: element.getAttribute("autocomplete") ?? undefined,
        placeholder: element.getAttribute("placeholder") ?? undefined,
        selector: elementSelector(element),
      },
      accessibility: {
        label,
        ariaLabel,
        ariaLabelledBy,
        describedBy: describedByText(element),
        required:
          element.hasAttribute("required") ||
          element.getAttribute("aria-required") === "true" ||
          (element instanceof HTMLInputElement && element.required),
      },
      context: {
        nearbyText,
        previousText,
        nextText,
        sectionTitle,
        sectionType: classifySectionType(sectionTitle, formTitle, label, ariaLabel, ariaLabelledBy, ...nearbyText),
        formTitle,
        pageTitle: element.ownerDocument.title || undefined,
        buttonTextsNearby: buttonTextsNearby(element),
      },
      options: optionsFor(element),
      geometry: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        visible,
      },
      state: {
        disabled,
        readonly,
        empty: !(element as any).value,
        currentValue: (element as any).value ?? undefined,
      }
    };
  }).filter((candidate) => candidate.geometry.visible && !candidate.state.disabled && !candidate.state.readonly);

  const groups = detectRepeatableGroups(candidates);
  for (const group of groups) {
    for (const field of group.fields) {
      field.context.repeatableGroup = repeatableGroupHint(group);
    }
  }

  return candidates;
}

export function detectPlatform(url = window.location.href): PlatformDetection {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.endsWith("linkedin.com")) {
    return { adapterId: "linkedin-copy-only", label: "LinkedIn copy-assist", confidence: 1, restricted: true, copyOnly: true };
  }
  if (hostname.includes("myworkdayjobs.com")) return { adapterId: "workday", label: "Workday", confidence: 0.95 };
  if (hostname.includes("smartrecruiters.com")) return { adapterId: "smartrecruiters", label: "SmartRecruiters", confidence: 0.95 };
  if (hostname.includes("greenhouse.io")) return { adapterId: "greenhouse", label: "Greenhouse", confidence: 0.95 };
  if (hostname.includes("personio.")) return { adapterId: "personio", label: "Personio", confidence: 0.9 };
  return { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 };
}
