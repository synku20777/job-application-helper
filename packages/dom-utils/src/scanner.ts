import type { FormFieldNode, PlatformDetection } from "@job-helper/shared";
import { compactText, getAriaLabelledByText, getAssociatedLabel, getNearbyText, getSectionHeading } from "./labels";
import { elementSelector, ensureElementId, isVisible, queryFillableElements } from "./inputs";

function optionsFor(element: HTMLElement): string[] | undefined {
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.options).map((option) => compactText(option.textContent || option.value)).filter(Boolean);
  }
  if (element.getAttribute("role") === "combobox") {
    return Array.from(document.querySelectorAll<HTMLElement>("[role='option']")).map((option) => compactText(option.textContent)).filter(Boolean);
  }
  return undefined;
}

function formHeadingFor(element: HTMLElement): string | undefined {
  const form = element.closest("form");
  if (!form) return undefined;
  const heading = form.querySelector("h1,h2,h3,legend,[role='heading']");
  return compactText(heading?.textContent) || undefined;
}

export function scanFormFields(root: ParentNode = document): FormFieldNode[] {
  return queryFillableElements(root).map((element) => {
    const elementId = ensureElementId(element);
    const inputType = element instanceof HTMLInputElement ? element.type : undefined;

    return {
      elementId,
      selector: elementSelector(element),
      tagName: element.tagName.toLowerCase(),
      inputType,
      role: element.getAttribute("role") ?? undefined,
      name: element.getAttribute("name") ?? undefined,
      id: element.getAttribute("id") ?? undefined,
      placeholder: element.getAttribute("placeholder") ?? undefined,
      ariaLabel: element.getAttribute("aria-label") ?? undefined,
      ariaLabelledByText: getAriaLabelledByText(element),
      associatedLabelText: getAssociatedLabel(element),
      nearbyText: getNearbyText(element),
      sectionHeading: getSectionHeading(element),
      formHeading: formHeadingFor(element),
      options: optionsFor(element),
      required:
        element.hasAttribute("required") ||
        element.getAttribute("aria-required") === "true" ||
        (element instanceof HTMLInputElement && element.required),
      visible: isVisible(element),
      disabled:
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true" ||
        ((element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement) &&
          element.disabled)
    };
  });
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
