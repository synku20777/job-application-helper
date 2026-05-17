import { describe, expect, it, vi } from "vitest";
import { escapeCssIdentifier, executeFillPlan, scanFormFields, setNativeValue, setSelectValue } from "@job-helper/dom-utils";
import type { FillPlan } from "@job-helper/shared";

describe("dom utils", () => {
  it("escapes selector identifiers without a native CSS.escape", () => {
    expect(document.querySelector(`input[name="${escapeCssIdentifier("job_application[first_name]")}"]`)).toBeNull();
    document.body.innerHTML = `<input name="job_application[first_name]" />`;
    expect(document.querySelector(`input[name="${escapeCssIdentifier("job_application[first_name]")}"]`)).not.toBeNull();
  });

  it("scans labels and input metadata", () => {
    document.body.innerHTML = `<label for="first">First Name</label><input id="first" />`;
    const fields = scanFormFields(document);
    expect(fields[0]?.associatedLabelText).toBe("First Name");
  });

  it("dispatches native input events", () => {
    document.body.innerHTML = `<input id="email" />`;
    const input = document.querySelector<HTMLInputElement>("#email")!;
    const listener = vi.fn();
    input.addEventListener("input", listener);
    setNativeValue(input, "john.smith@example.com");
    expect(input.value).toBe("john.smith@example.com");
    expect(listener).toHaveBeenCalled();
  });

  it("matches select values by normalized text", () => {
    document.body.innerHTML = `<select id="remote"><option value="hybrid-work">Hybrid</option></select>`;
    const select = document.querySelector<HTMLSelectElement>("#remote")!;
    expect(setSelectValue(select, "hybrid")).toBe(true);
    expect(select.value).toBe("hybrid-work");
  });

  it("executes accepted fill steps", () => {
    document.body.innerHTML = `<label for="first">First Name</label><input id="first" data-job-autofill-id="first" />`;
    const plan: FillPlan = {
      id: "plan-1",
      adapterId: "generic-html-form",
      url: "https://example.test",
      createdAt: new Date().toISOString(),
      profileId: "default",
      detectedPlatform: "Generic form",
      warnings: [],
      steps: [
        {
          type: "setText",
          target: { elementId: "first", selector: "#first", label: "First Name" },
          canonicalKey: "personal.firstName",
          value: "John",
          confidence: 0.95,
          requiresReview: false
        }
      ]
    };
    const result = executeFillPlan(plan, ["first"]);
    expect(result.status).toBe("success");
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("John");
  });

  it("does not fill excluded steps", () => {
    document.body.innerHTML = `<label for="first">First Name</label><input id="first" data-job-autofill-id="first" />`;
    const plan: FillPlan = {
      id: "plan-1",
      adapterId: "generic-html-form",
      url: "https://example.test",
      createdAt: new Date().toISOString(),
      profileId: "default",
      detectedPlatform: "Generic form",
      warnings: [],
      steps: [
        {
          type: "setText",
          target: { elementId: "first", selector: "#first", label: "First Name" },
          canonicalKey: "personal.firstName",
          value: "John",
          confidence: 0.95,
          requiresReview: false
        }
      ]
    };
    const result = executeFillPlan(plan, []);
    expect(result.skippedSteps).toBe(1);
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("");
  });
});
