import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "@job-helper/profile-schema";
import { sampleProfile } from "@job-helper/profile-schema";
import { buildFillPlanWithAdapter, executeWithAdapter, scanWithAdapter, type AtsAdapter } from "@job-helper/adapters";
import type { SiteMappingOverride } from "@job-helper/shared";

const pipelineAdapter: AtsAdapter = {
  id: "pipeline-test",
  label: "Pipeline Test",
  priority: 1,
  async detect() {
    return { adapterId: "pipeline-test", label: "Pipeline Test", confidence: 1 };
  },
  getSemanticHints() {
    return {
      fieldBoosts: [{ key: "personal.lastName", patterns: [/\bcustom applicant name\b/i] }],
      manualField: (field) =>
        field.accessibility.label === "Custom screening question"
          ? { reason: "Screening question requires manual review." }
          : undefined
    };
  },
  async scan(context) {
    return scanWithAdapter(this, context);
  },
  async buildFillPlan(fields, profile, options, url) {
    return buildFillPlanWithAdapter(this, fields, profile, options, url);
  },
  async executeFillPlan(plan, context, acceptedElementIds) {
    return executeWithAdapter(this, plan, context, acceptedElementIds);
  }
};

function siteOverride(fields: SiteMappingOverride["fields"]): SiteMappingOverride {
  return {
    id: "pipeline-test:example.test",
    hostname: "example.test",
    adapterId: "pipeline-test",
    fields,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("adapter pipeline", () => {
  it("runs shared scan, semantic boosts, manual policy, and execution", async () => {
    document.body.innerHTML = `
      <label for="name">Custom applicant name</label>
      <input id="name" />
      <label for="question">Custom screening question</label>
      <textarea id="question"></textarea>
    `;

    const fields = await pipelineAdapter.scan({ document });
    const plan = await pipelineAdapter.buildFillPlan(fields, sampleProfile, {}, "https://example.test/apply");
    const lastNameStep = plan.steps.find((step) => "canonicalKey" in step && step.canonicalKey === "personal.lastName");

    expect(lastNameStep).toEqual(expect.objectContaining({ type: "setText", value: sampleProfile.personal.lastName }));
    expect(plan.steps).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "manual", reason: "Screening question requires manual review." })])
    );

    const result = await pipelineAdapter.executeFillPlan(plan, { document }, [lastNameStep!.target.candidateId]);
    expect(result.completedSteps).toBe(1);
    expect(document.querySelector<HTMLInputElement>("#name")?.value).toBe(sampleProfile.personal.lastName);
  });

  it("applies overrides before semantic boosts and keeps sensitive overrides review-required", async () => {
    document.body.innerHTML = `
      <label for="name">Custom applicant name</label>
      <input id="name" />
      <label for="gender">Gender</label>
      <select id="gender"><option value="woman">Woman</option></select>
    `;

    const fields = await pipelineAdapter.scan({ document });
    const plan = await pipelineAdapter.buildFillPlan(
      fields,
      sampleProfile as CandidateProfile,
      {
        siteOverride: siteOverride([
          {
            id: "override-name",
            canonicalKey: "personal.firstName",
            elementSelector: "#name",
            label: "Custom applicant name",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          },
          {
            id: "override-gender",
            canonicalKey: "demographics.gender",
            elementSelector: "#gender",
            label: "Gender",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          }
        ])
      },
      "https://example.test/apply"
    );

    expect(plan.steps.find((step) => step.target.selector === "#name")).toEqual(
      expect.objectContaining({ type: "setText", canonicalKey: "personal.firstName", value: sampleProfile.personal.firstName })
    );
    expect(plan.steps.find((step) => step.target.selector === "#gender")).toEqual(
      expect.objectContaining({ canonicalKey: "demographics.gender", requiresReview: true })
    );
  });
});
