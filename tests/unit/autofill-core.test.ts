import { describe, expect, it } from "vitest";
import { buildFillPlan, confidenceBucket, matchField, resolveEffectiveSynonyms, resolveProfileValue } from "@job-helper/autofill-core";
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
});
