import { describe, expect, it } from "vitest";
import {
  buildFillPlan,
  classifyFields,
  confidenceBucket,
  matchField,
  matchOption,
  resolveEffectiveSynonyms,
  resolveProfileValue
} from "@job-helper/autofill-core";
import { sampleProfile } from "@job-helper/profile-schema";
import type { SerializableFieldCandidate } from "@job-helper/shared";

function node(overrides: {
  id?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  name?: string;
  sectionTitle?: string;
  formTitle?: string;
  nearbyText?: string[];
  autocomplete?: string;
  sectionType?: SerializableFieldCandidate["context"]["sectionType"];
  options?: SerializableFieldCandidate["options"];
  visible?: boolean;
  disabled?: boolean;
  tagName?: string;
  type?: string;
  selector?: string;
} = {}): SerializableFieldCandidate {
  return {
    id: overrides.id ?? "field-1",
    controlType: "text",
    dom: {
      tagName: overrides.tagName ?? "input",
      type: overrides.type ?? "text",
      id: overrides.id ?? "field-1",
      name: overrides.name,
      autocomplete: overrides.autocomplete,
      placeholder: overrides.placeholder,
      selector: overrides.selector ?? `#${overrides.id ?? "field-1"}`,
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
      sectionType: overrides.sectionType,
      formTitle: overrides.formTitle,
      buttonTextsNearby: [],
      pageTitle: undefined,
      repeatableGroup: undefined,
    },
    options: overrides.options,
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

describe("autofill core", () => {
  it("matches common labels", () => {
    const match = matchField(node({ label: "First Name" }));
    expect(match?.canonicalKey).toBe("personal.firstName");
    expect(match?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("uses German label dictionaries", () => {
    const cases = [
      ["Vorname", "personal.firstName"],
      ["Nachname", "personal.lastName"],
      ["Telefon", "personal.phone"],
      ["Mobilnummer", "personal.phone"],
      ["Adresse", "personal.address.line1"],
      ["Postleitzahl", "personal.address.postalCode"],
      ["Lebenslauf", "documents.resume"],
      ["Anschreiben", "documents.coverLetter"],
      ["Berufserfahrung", "workExperience.description"],
      ["Ausbildung", "education.institution"],
      ["Kenntnisse", "skills"]
    ] as const;

    for (const [label, canonicalKey] of cases) {
      expect(matchField(node({ label }), "generic-html-form", { locales: ["de-DE"] })?.canonicalKey).toBe(canonicalKey);
    }
  });

  it("falls back to default dictionaries without locale hints", () => {
    expect(matchField(node({ label: "Mobilnummer" }))?.canonicalKey).toBe("personal.phone");
    expect(resolveEffectiveSynonyms([])["documents.resume"]).toEqual(expect.arrayContaining(["resume", "lebenslauf"]));
  });

  it("uses confidence thresholds", () => {
    expect(confidenceBucket(0.95, false)).toBe("auto");
    expect(confidenceBucket(0.75, false)).toBe("review");
    expect(confidenceBucket(0.4, false)).toBe("skip");
  });

  it("prevents bad mappings with negative labels", () => {
    const match = matchField(node({ label: "Reference First Name", name: "reference_first_name" }));
    expect(match?.canonicalKey).not.toBe("personal.firstName");
  });

  it("uses multi-signal scoring for high-confidence semantic matches", () => {
    const match = matchField(
      node({
        id: "fname",
        label: "Given name",
        name: "first_name",
        autocomplete: "given-name",
        sectionType: "personal",
        sectionTitle: "Personal information"
      })
    );

    expect(match?.canonicalKey).toBe("personal.firstName");
    expect(match?.confidence).toBe(1);
    expect(match?.requiresReview).toBe(false);
  });

  it("skips weak unknown fields below review threshold", () => {
    const matches = classifyFields([node({ label: "Favorite color", nearbyText: ["Optional preferences"] })]);
    expect(matches).toHaveLength(0);
  });

  it("always reviews sensitive fields", () => {
    const match = matchField(node({ label: "Gender" }));
    expect(match?.canonicalKey).toBe("demographics.gender");
    expect(match?.requiresReview).toBe(true);

    const germanMatch = matchField(node({ label: "Arbeitserlaubnis" }), "generic-html-form", { locales: ["de-DE"] });
    expect(germanMatch?.canonicalKey).toBe("applicationDefaults.sponsorshipRequiredDefault");
    expect(germanMatch?.requiresReview).toBe(true);
  });

  it("resolves scalar and array profile values", () => {
    expect(resolveProfileValue(sampleProfile, "personal.email")).toBe("john.smith@example.com");
    expect(resolveProfileValue(sampleProfile, "skills")).toContain("TypeScript");
  });

  it("builds a fill plan from nodes", () => {
    const plan = buildFillPlan(
      [
        node({ id: "first", selector: "#first", label: "First Name" }),
        node({ id: "email", selector: "#email", label: "Email" })
      ],
      sampleProfile,
      { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 },
      "https://example.test"
    );
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0]?.type).toBe("setText");
  });

  it("matches equivalent select options", () => {
    expect(matchOption([{ label: "Yes", value: "1" }], "Yes")).toMatchObject({ matched: true, strategy: "exact" });
    expect(matchOption([{ label: "Prefer not to disclose", value: "decline" }], "decline to answer")).toMatchObject({
      matched: true,
      strategy: "synonym"
    });
    expect(matchOption([{ label: "Hybrid work", value: "hybrid" }], "Hybrid")).toMatchObject({ matched: true });
    expect(matchOption([{ label: "On-site", value: "office" }], "onsite")).toMatchObject({ matched: true });
    expect(matchOption([{ label: "Completely different", value: "x" }], "remote")).toMatchObject({ matched: false, strategy: "manual" });
  });

  it("uses option matcher when building select steps", () => {
    const plan = buildFillPlan(
      [
        node({
          id: "remote",
          selector: "#remote",
          tagName: "select",
          label: "Remote preference",
          sectionType: "screening",
          options: [
            { label: "Hybrid work", value: "hybrid-work" },
            { label: "Office", value: "office" }
          ]
        })
      ],
      sampleProfile,
      { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 },
      "https://example.test"
    );

    expect(plan.steps[0]).toMatchObject({ type: "selectOption", value: "hybrid-work" });
  });
});
