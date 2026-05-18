import { describe, expect, it } from "vitest";
import {
  buildFieldSignature,
  detectPageActions,
  hostnameMatchesRecipe,
  matchFieldsWithLocalOverrides,
  matchFieldsWithSiteRecipes,
  matchLocalMappingOverride,
  validateSiteRecipe
} from "@job-helper/autofill-core";
import type { LocalMappingOverride, SerializableFieldCandidate, SiteRecipe } from "@job-helper/shared";

function field(overrides: Partial<SerializableFieldCandidate> & { id: string; label?: string; selector?: string } = { id: "first" }): SerializableFieldCandidate {
  return {
    id: overrides.id,
    controlType: "text",
    dom: {
      tagName: "input",
      type: "text",
      id: overrides.id,
      name: overrides.dom?.name ?? overrides.id,
      placeholder: overrides.dom?.placeholder,
      selector: overrides.selector ?? `#${overrides.id}`,
      ...overrides.dom
    },
    accessibility: {
      label: overrides.label,
      ariaLabel: overrides.accessibility?.ariaLabel,
      ...overrides.accessibility
    },
    context: {
      nearbyText: [],
      previousText: [],
      nextText: [],
      sectionTitle: "Personal information",
      sectionType: "personal",
      ...overrides.context
    },
    geometry: { x: 0, y: 0, width: 100, height: 20, visible: true, ...overrides.geometry },
    state: { disabled: false, readonly: false, empty: true, ...overrides.state },
    options: overrides.options
  };
}

function overrideFor(candidate: SerializableFieldCandidate): LocalMappingOverride {
  return {
    id: "override-1",
    hostname: "example.test",
    adapterId: "generic-html-form",
    fieldSignature: buildFieldSignature(candidate),
    canonicalKey: "personal.firstName",
    confidenceBoost: 0.1,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastUsedAt: "2026-01-01T00:00:00.000Z",
    useCount: 1
  };
}

describe("phase 7 universal features", () => {
  it("creates stable field signatures and scores local mapping overrides", () => {
    const candidate = field({ id: "legalGiven", label: "Legal Given Name", selector: "#legalGiven" });
    const signature = buildFieldSignature(candidate);
    const override = overrideFor(candidate);

    expect(signature).toMatchObject({
      labelText: "Legal Given Name",
      name: "legalGiven",
      sectionTitle: "Personal information",
      domPathHint: "#legalGiven"
    });
    expect(matchLocalMappingOverride(candidate, override)).toBeGreaterThanOrEqual(0.7);
  });

  it("applies local mapping overrides before generic matching", () => {
    const candidate = field({ id: "legalGiven", label: "Legal Given Name", selector: "#legalGiven" });
    const result = matchFieldsWithLocalOverrides([candidate], "generic-html-form", [overrideFor(candidate)]);

    expect(result.overrideMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalKey: "personal.firstName",
          evidence: expect.arrayContaining([expect.objectContaining({ type: "userOverride" })])
        })
      ])
    );
    expect(result.remainingFields).toEqual([]);
    expect(result.appliedOverrideIds).toEqual(["override-1"]);
  });

  it("validates and applies site recipe field selectors", () => {
    const recipe = validateSiteRecipe({
      id: "example-ats",
      label: "Example ATS",
      hostnamePattern: "*.example.test",
      fields: {
        "personal.firstName": [{ selector: "#first", strategy: "css" }]
      }
    }) as SiteRecipe;
    const result = matchFieldsWithSiteRecipes([field({ id: "first", label: "Given", selector: "#first" })], "generic-html-form", [
      { ...recipe, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
    ]);

    expect(hostnameMatchesRecipe("jobs.example.test", { ...recipe, createdAt: "", updatedAt: "" })).toBe(true);
    expect(result.recipeMatches[0]).toEqual(expect.objectContaining({ canonicalKey: "personal.firstName" }));
    expect(() =>
      validateSiteRecipe({
        id: "unsafe",
        label: "Unsafe",
        hostnamePattern: "example.test",
        fields: { "personal.firstName": [{ selector: "javascript:alert(1)", strategy: "css" }] }
      })
    ).toThrow(/Unsafe/);
  });

  it("detects suggested page actions without executing them", () => {
    document.body.innerHTML = `
      <button id="add-exp">Add Work Experience</button>
      <button id="add-edu">Add Education</button>
      <button id="next">Save and Continue</button>
      <button id="resume">Upload Resume</button>
      <button id="cover">Attach Cover Letter</button>
    `;

    const actions = detectPageActions(document);
    expect(actions.map((action) => action.type)).toEqual(
      expect.arrayContaining(["addExperience", "addEducation", "nextStep", "uploadResume", "uploadCoverLetter"])
    );
  });
});
