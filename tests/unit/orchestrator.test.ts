import { describe, expect, it } from "vitest";
import {
  acceptedCandidateIdsForMode,
  AutofillOrchestrator,
  buildFillPlan,
  buildFillPlanDiagnostics,
  matchFields
} from "@job-helper/autofill-core";
import { sampleProfile } from "@job-helper/profile-schema";
import type { FillPlan, SerializableFieldCandidate } from "@job-helper/shared";

function candidate(id: string, label: string): SerializableFieldCandidate {
  return {
    id,
    controlType: "text",
    dom: {
      tagName: "input",
      type: "text",
      id,
      selector: `#${id}`
    },
    accessibility: { label },
    context: {
      nearbyText: [],
      previousText: [],
      nextText: [],
      sectionTitle: "Personal information",
      sectionType: "personal",
      repeatableGroup: id === "first" ? { id: "repeatable-experience-1", type: "experience", index: 0, confidence: 0.8 } : undefined
    },
    geometry: { x: 0, y: 0, width: 100, height: 20, visible: true },
    state: { disabled: false, readonly: false, empty: true }
  };
}

describe("autofill orchestrator", () => {
  it("builds diagnostics for matches, plan rows, sections, groups, and warnings", () => {
    const fields = [candidate("first", "First name"), candidate("unknown", "Unmatched custom field")];
    const matches = matchFields(fields, "generic-html-form");
    const plan = buildFillPlan(
      fields,
      sampleProfile,
      { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 },
      "https://example.test/apply"
    );

    const diagnostics = buildFillPlanDiagnostics(fields, matches, plan, "generic-html-form");

    expect(diagnostics.parser.candidateFields).toBe(2);
    expect(diagnostics.parser.sectionsDetected).toBeGreaterThan(0);
    expect(diagnostics.parser.repeatableGroupsDetected).toBe(1);
    expect(diagnostics.parser.highConfidenceMatches).toBeGreaterThan(0);
    expect(diagnostics.steps[0]).toEqual(
      expect.objectContaining({
        candidateId: "first",
        canonicalKey: "personal.firstName",
        driver: "nativeText"
      })
    );
    expect(diagnostics.steps[0].evidence.length).toBeGreaterThan(0);
  });

  it("selects accepted candidate ids by execution mode", () => {
    const fields = [candidate("first", "First name")];
    const plan = buildFillPlan(
      fields,
      sampleProfile,
      { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 },
      "https://example.test/apply"
    );

    expect(acceptedCandidateIdsForMode(plan, "conservative")).toEqual(["first"]);
    expect(acceptedCandidateIdsForMode(plan, "assisted")).toEqual([]);
    expect(acceptedCandidateIdsForMode(plan, "recorder")).toEqual([]);
  });

  it("coordinates scanner, classifier, plan builder, and executor dependencies", async () => {
    const fields = [candidate("first", "First name")];
    const plan = buildFillPlan(
      fields,
      sampleProfile,
      { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 },
      "https://example.test/apply"
    );

    const orchestrator = new AutofillOrchestrator(
      { async scan() { return fields; } },
      { classify(candidates) { return matchFields(candidates, "generic-html-form"); } },
      {
        build() {
          return plan;
        }
      },
      {
        async execute(fillPlan: FillPlan, acceptedCandidateIds: string[]) {
          return {
            fillPlanId: fillPlan.id,
            status: "success",
            completedSteps: acceptedCandidateIds.length,
            skippedSteps: 0,
            manualSteps: 0,
            errors: []
          };
        }
      }
    );

    const inspection = await orchestrator.inspectPage({
      document,
      profile: sampleProfile,
      adapter: { id: "generic-html-form", label: "Generic form" },
      platform: { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 },
      url: "https://example.test/apply",
      executionMode: "conservative"
    });

    expect(inspection.fields).toHaveLength(1);
    expect(inspection.matches).toHaveLength(1);
    expect(inspection.acceptedCandidateIds).toEqual(["first"]);

    const result = await orchestrator.executePlan(inspection.plan, inspection.acceptedCandidateIds);
    expect(result.completedSteps).toBe(1);
  });
});
