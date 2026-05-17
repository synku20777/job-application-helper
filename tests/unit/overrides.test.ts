import { describe, expect, it } from "vitest";
import { buildFillPlan } from "@job-helper/autofill-core";
import { sampleProfile } from "@job-helper/profile-schema";
import type { FormFieldNode, SiteMappingOverride } from "@job-helper/shared";

function field(overrides: Partial<FormFieldNode>): FormFieldNode {
  return {
    elementId: overrides.elementId ?? "field-1",
    selector: overrides.selector ?? "#field-1",
    tagName: overrides.tagName ?? "input",
    inputType: overrides.inputType ?? "text",
    associatedLabelText: overrides.associatedLabelText,
    ariaLabel: overrides.ariaLabel,
    ariaLabelledByText: overrides.ariaLabelledByText,
    placeholder: overrides.placeholder,
    name: overrides.name,
    id: overrides.id,
    nearbyText: overrides.nearbyText ?? [],
    sectionHeading: overrides.sectionHeading,
    formHeading: overrides.formHeading,
    options: overrides.options,
    required: overrides.required,
    visible: overrides.visible ?? true,
    disabled: overrides.disabled ?? false
  };
}

function siteOverride(fields: SiteMappingOverride["fields"]): SiteMappingOverride {
  return {
    id: "generic-html-form:example.test",
    hostname: "example.test",
    adapterId: "generic-html-form",
    fields,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("site mapping overrides", () => {
  it("uses selector overrides before generic matching", () => {
    const plan = buildFillPlan(
      [field({ selector: "#first_name", associatedLabelText: "First name" })],
      sampleProfile,
      { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 },
      "https://example.test/jobs/1",
      {
        siteOverride: siteOverride([
          {
            id: "override-1",
            canonicalKey: "personal.lastName",
            elementSelector: "#first_name",
            label: "First name",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          }
        ])
      }
    );

    expect(plan.steps).toEqual([
      expect.objectContaining({
        type: "setText",
        canonicalKey: "personal.lastName",
        value: sampleProfile.personal.lastName,
        confidence: 1
      })
    ]);
  });

  it("uses label overrides for ambiguous fields", () => {
    const plan = buildFillPlan(
      [field({ selector: "#candidate_link", associatedLabelText: "Profile" })],
      sampleProfile,
      { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 },
      "https://example.test/jobs/1",
      {
        siteOverride: siteOverride([
          {
            id: "override-1",
            canonicalKey: "personal.links.linkedin",
            label: "Profile",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          }
        ])
      }
    );

    expect(plan.steps).toEqual([
      expect.objectContaining({
        type: "setText",
        canonicalKey: "personal.links.linkedin",
        value: sampleProfile.personal.links?.linkedin
      })
    ]);
  });

  it("keeps sensitive override mappings review-required", () => {
    const plan = buildFillPlan(
      [field({ selector: "#gender", associatedLabelText: "Gender" })],
      sampleProfile,
      { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 },
      "https://example.test/jobs/1",
      {
        siteOverride: siteOverride([
          {
            id: "override-1",
            canonicalKey: "demographics.gender",
            elementSelector: "#gender",
            label: "Gender",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          }
        ])
      }
    );

    expect(plan.steps).toEqual([
      expect.objectContaining({
        canonicalKey: "demographics.gender",
        requiresReview: true
      })
    ]);
  });
});
