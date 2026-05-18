import { describe, expect, it } from "vitest";
import { escapeCssIdentifier, executeFillPlan, scanFormFields } from "@job-helper/dom-utils";
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
    expect(fields[0]?.accessibility.label).toBe("First Name");
  });

  it("executes accepted fill steps", async () => {
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
          target: { candidateId: "first", selector: "#first", label: "First Name" },
          canonicalKey: "personal.firstName",
          value: "John",
          confidence: 0.95,
          requiresReview: false
        }
      ]
    };
    const result = await executeFillPlan(plan, ["first"]);
    expect(result.status).toBe("success");
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("John");
  });

  it("does not fill excluded steps", async () => {
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
          target: { candidateId: "first", selector: "#first", label: "First Name" },
          canonicalKey: "personal.firstName",
          value: "John",
          confidence: 0.95,
          requiresReview: false
        }
      ]
    };
    const result = await executeFillPlan(plan, []);
    expect(result.skippedSteps).toBe(1);
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("");
  });
});
