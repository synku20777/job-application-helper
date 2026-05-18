import { describe, expect, it } from "vitest";
import { buildFillPlan } from "@job-helper/autofill-core";
import { sampleProfile } from "@job-helper/profile-schema";
import type { SerializableFieldCandidate, SiteMappingOverride } from "@job-helper/shared";

function field(overrides: {
  id?: string;
  selector?: string;
  tagName?: string;
  type?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  name?: string;
  nearbyText?: string[];
  sectionTitle?: string;
  formTitle?: string;
  visible?: boolean;
  disabled?: boolean;
} = {}): SerializableFieldCandidate {
  const candidateId = overrides.id ?? "field-1";
  return {
    id: candidateId,
    controlType: "text",
    dom: {
      tagName: overrides.tagName ?? "input",
      type: overrides.type ?? "text",
      id: candidateId,
      name: overrides.name,
      placeholder: overrides.placeholder,
      selector: overrides.selector ?? `#${candidateId}`,
    },
    accessibility: {
      label: overrides.label,
      ariaLabel: overrides.ariaLabel,
      required: false,
    },
    context: {
      nearbyText: overrides.nearbyText ?? [],
      previousText: [],
      nextText: [],
      sectionTitle: overrides.sectionTitle,
      formTitle: overrides.formTitle,
    },
    geometry: {
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      visible: overrides.visible ?? true,
    },
    state: {
      disabled: overrides.disabled ?? false,
      readonly: false,
      empty: true,
    },
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
      [field({ id: "first_name", selector: "#first_name", label: "First name" })],
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
      [field({ id: "candidate_link", selector: "#candidate_link", label: "Profile" })],
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
      [field({ id: "gender", selector: "#gender", label: "Gender" })],
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
