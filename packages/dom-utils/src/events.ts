import type { FillPlan, FillResult, FillStep } from "@job-helper/shared";
import { normalizeText } from "@job-helper/autofill-core";
import { escapeCssIdentifier } from "./selectors";

export function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

export function setSelectValue(select: HTMLSelectElement, value: string): boolean {
  const option = Array.from(select.options).find(
    (candidate) => normalizeText(candidate.textContent || candidate.value) === normalizeText(value)
  );
  if (!option) return false;

  select.value = option.value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function findTarget(step: FillStep): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(`[data-job-autofill-id="${escapeCssIdentifier(step.target.elementId)}"]`) ??
    document.querySelector<HTMLElement>(step.target.selector)
  );
}

export function executeFillPlan(plan: FillPlan, acceptedElementIds: string[]): FillResult {
  const accepted = new Set(acceptedElementIds);
  const errors: FillResult["errors"] = [];
  let completedSteps = 0;
  let skippedSteps = 0;
  let manualSteps = 0;

  for (const step of plan.steps) {
    if (step.type === "manual" || step.type === "uploadFile") {
      manualSteps += 1;
      continue;
    }

    if (!accepted.has(step.target.elementId)) {
      skippedSteps += 1;
      continue;
    }

    const element = findTarget(step);
    if (!element) {
      errors.push({ code: "FIELD_NOT_VISIBLE", message: "Field was not found on the page.", elementId: step.target.elementId });
      skippedSteps += 1;
      continue;
    }

    if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") {
      errors.push({ code: "FIELD_DISABLED", message: "Field is disabled.", elementId: step.target.elementId });
      skippedSteps += 1;
      continue;
    }

    if (step.type === "setText" && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      setNativeValue(element, step.value);
      completedSteps += 1;
      continue;
    }

    if (step.type === "selectOption" && element instanceof HTMLSelectElement) {
      if (setSelectValue(element, step.value)) completedSteps += 1;
      else {
        errors.push({ code: "OPTION_NOT_FOUND", message: "Matching option was not found.", elementId: step.target.elementId });
        skippedSteps += 1;
      }
      continue;
    }

    if (step.type === "clickCheckbox" && element instanceof HTMLInputElement) {
      element.checked = step.checked;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      completedSteps += 1;
      continue;
    }

    errors.push({ code: "UNKNOWN", message: "Unsupported field type for this fill step.", elementId: step.target.elementId });
    skippedSteps += 1;
  }

  return {
    fillPlanId: plan.id,
    status: errors.length > 0 || skippedSteps > 0 ? (completedSteps > 0 ? "partial" : "failed") : "success",
    completedSteps,
    skippedSteps,
    manualSteps,
    errors
  };
}
