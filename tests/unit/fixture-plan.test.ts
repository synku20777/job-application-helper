import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFillPlan } from "@job-helper/autofill-core";
import { sampleProfile } from "@job-helper/profile-schema";
import { scanFormFields } from "@job-helper/dom-utils";

const fixtures: Record<string, string[]> = {
  "generic-form.html": ["personal.firstName", "personal.lastName", "personal.email", "personal.phone", "personal.links.linkedin", "skills"],
  "generic-german.html": [
    "personal.firstName",
    "personal.lastName",
    "personal.phone",
    "personal.address.line1",
    "personal.address.postalCode",
    "documents.resume",
    "documents.coverLetter",
    "workExperience.company",
    "education.institution",
    "skills"
  ],
  "generic-mixed-language.html": [
    "personal.firstName",
    "personal.lastName",
    "personal.email",
    "personal.phone",
    "personal.links.portfolio",
    "skills"
  ],
  "greenhouse-basic.html": ["personal.firstName", "personal.lastName", "personal.email", "personal.phone", "documents.resume"],
  "greenhouse-uploads.html": ["personal.firstName", "personal.lastName", "documents.resume", "documents.coverLetter"],
  "greenhouse-custom-questions.html": ["personal.firstName", "personal.email"],
  "greenhouse-embedded.html": ["personal.firstName", "personal.lastName", "personal.email"],
  "smartrecruiters-basic.html": ["personal.firstName", "personal.lastName", "personal.email", "personal.phone", "personal.links.portfolio"],
  "smartrecruiters-uploads.html": ["personal.firstName", "personal.lastName", "documents.resume", "documents.coverLetter", "personal.links.linkedin"],
  "smartrecruiters-address.html": [
    "personal.address.line1",
    "personal.address.city",
    "personal.address.region",
    "personal.address.postalCode",
    "personal.address.country"
  ],
  "smartrecruiters-custom-questions.html": ["personal.email"],
  "smartrecruiters-step-contact.html": ["personal.firstName", "personal.lastName", "personal.email"],
  "smartrecruiters-step-profile.html": ["personal.phone", "personal.links.portfolio", "documents.resume"],
  "personio-basic-en.html": ["personal.firstName", "personal.lastName", "personal.phone", "documents.resume"],
  "personio-basic-de.html": ["personal.firstName", "personal.lastName", "personal.phone", "documents.resume"],
  "personio-uploads.html": ["personal.firstName", "personal.lastName", "documents.resume", "documents.coverLetter", "personal.links.linkedin"],
  "personio-availability-custom.html": ["personal.email"],
  "personio-embedded.html": ["personal.firstName", "personal.lastName", "personal.email", "personal.links.portfolio"]
};

describe("fixture fill plans", () => {
  for (const [fixture, expectedKeys] of Object.entries(fixtures)) {
    it(`creates a stable fill plan for ${fixture}`, () => {
      document.body.innerHTML = readFileSync(resolve("tests/fixtures", fixture), "utf8");
      const fields = scanFormFields(document);
      const plan = buildFillPlan(fields, sampleProfile, { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 });
      const keys = plan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));
      expect(keys).toEqual(expect.arrayContaining(expectedKeys));
    });
  }
});
