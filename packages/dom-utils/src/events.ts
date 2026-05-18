import type { FillPlan, FillResult, FillStep } from "@job-helper/shared";
import { elementToDriverField, resolveDriver } from "@job-helper/autofill-core";
import { escapeCssIdentifier } from "./selectors";

function findTarget(step: FillStep): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(`[data-job-autofill-id="${escapeCssIdentifier(step.target.candidateId)}"]`) ??
    document.querySelector<HTMLElement>(step.target.selector)
  );
}

export async function executeFillPlan(plan: FillPlan, acceptedElementIds: string[]): Promise<FillResult> {
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

    if (!accepted.has(step.target.candidateId)) {
      skippedSteps += 1;
      continue;
    }

    const element = findTarget(step);
    if (!element) {
      errors.push({ code: "FIELD_NOT_VISIBLE", message: "Field was not found on the page.", candidateId: step.target.candidateId });
      skippedSteps += 1;
      continue;
    }

    const driverField = elementToDriverField(element, step.target.candidateId);
    const driver = resolveDriver(driverField);

    if (!driver) {
      errors.push({ code: "UNKNOWN", message: "Unsupported field type for this fill step.", candidateId: step.target.candidateId });
      skippedSteps += 1;
      continue;
    }

    let valueToFill: unknown;
    if (step.type === "setText" || step.type === "selectOption") {
      valueToFill = step.value;
    } else if (step.type === "clickCheckbox") {
      valueToFill = step.checked;
    }

    const result = await driver.fill(driverField, valueToFill, { document: document, window: window });
    
    if (result.status === "filled") {
      completedSteps += 1;
    } else {
      errors.push(result.error ?? { code: "UNKNOWN", message: "Driver failed to fill.", candidateId: step.target.candidateId });
      skippedSteps += 1;
    }
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
