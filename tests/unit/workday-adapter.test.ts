import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectWorkdayPageState, detectWorkdayStepKind, workdayAdapter } from "@job-helper/adapters";
import { sampleProfile } from "@job-helper/profile-schema";
import type { SiteMappingOverride } from "@job-helper/shared";

function loadFixture(fixture: string) {
  document.body.innerHTML = readFileSync(resolve("tests/fixtures", fixture), "utf8");
}

const profileWithResume = {
  ...sampleProfile,
  documents: [
    {
      id: "doc_cv_pdf",
      type: "resume" as const,
      label: "CV",
      fileName: "CV.pdf",
      mimeType: "application/pdf"
    }
  ]
};

function siteOverride(fields: SiteMappingOverride["fields"]): SiteMappingOverride {
  return {
    id: "workday:example.myworkdayjobs.com",
    hostname: "example.myworkdayjobs.com",
    adapterId: "workday",
    fields,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("workdayAdapter", () => {
  it("detects hosted Workday domains", async () => {
    const detection = await workdayAdapter.detect({
      url: "https://example.myworkdayjobs.com/en-US/careers/job/123",
      hostname: "example.myworkdayjobs.com"
    });

    expect(detection.adapterId).toBe("workday");
    expect(detection.confidence).toBe(1);
  });

  it("classifies Workday page states and visible steps", () => {
    loadFixture("workday-contact.html");
    expect(detectWorkdayPageState(document)).toBe("applicationForm");
    expect(detectWorkdayStepKind(document)).toBe("contact");

    loadFixture("workday-documents.html");
    expect(detectWorkdayStepKind(document)).toBe("documents");

    loadFixture("workday-experience.html");
    expect(detectWorkdayStepKind(document)).toBe("experience");

    loadFixture("workday-education.html");
    expect(detectWorkdayStepKind(document)).toBe("education");

    loadFixture("workday-questions.html");
    expect(detectWorkdayStepKind(document)).toBe("questionsDisclosures");

    loadFixture("workday-review.html");
    expect(detectWorkdayPageState(document)).toBe("reviewSubmit");
    expect(detectWorkdayStepKind(document)).toBe("review");

    loadFixture("workday-login.html");
    expect(detectWorkdayPageState(document)).toBe("loginAccount");

    loadFixture("workday-assessment-captcha.html");
    expect(detectWorkdayPageState(document)).toBe("assessmentCaptcha");
  });

  it("maps current-step contact fields with exact adapter matches", async () => {
    loadFixture("workday-contact.html");
    const fields = await workdayAdapter.scan({ document });
    const plan = await workdayAdapter.buildFillPlan(
      fields,
      sampleProfile,
      {},
      "https://example.myworkdayjobs.com/en-US/careers/job/123"
    );
    const keys = plan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(plan.adapterId).toBe("workday");
    expect(plan.detectedPlatform).toBe("Workday");
    expect(keys).toEqual(
      expect.arrayContaining([
        "personal.firstName",
        "personal.lastName",
        "personal.email",
        "personal.phone",
        "personal.address.line1",
        "personal.address.city",
        "personal.address.country",
        "personal.links.linkedin",
        "personal.links.portfolio"
      ])
    );
  });

  it("marks resume and cover letter fields as upload/manual steps", async () => {
    loadFixture("workday-documents.html");
    const fields = await workdayAdapter.scan({ document });
    const plan = await workdayAdapter.buildFillPlan(
      fields,
      profileWithResume,
      {},
      "https://example.myworkdayjobs.com/en-US/careers/job/123"
    );

    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "uploadFile", documentId: "doc_cv_pdf", requiresUserAction: true })
      ])
    );
    expect(plan.steps.some((step) => step.type === "manual" && "canonicalKey" in step && step.canonicalKey === "documents.coverLetter")).toBe(
      true
    );
  });

  it("maps visible experience and education fields to first profile records", async () => {
    loadFixture("workday-experience.html");
    const experienceFields = await workdayAdapter.scan({ document });
    const experiencePlan = await workdayAdapter.buildFillPlan(
      experienceFields,
      sampleProfile,
      {},
      "https://example.myworkdayjobs.com/en-US/careers/job/123"
    );
    const experienceKeys = experiencePlan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    loadFixture("workday-education.html");
    const educationFields = await workdayAdapter.scan({ document });
    const educationPlan = await workdayAdapter.buildFillPlan(
      educationFields,
      sampleProfile,
      {},
      "https://example.myworkdayjobs.com/en-US/careers/job/123"
    );
    const educationKeys = educationPlan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(experienceKeys).toEqual(
      expect.arrayContaining([
        "workExperience.company",
        "workExperience.title",
        "workExperience.location",
        "workExperience.startDate",
        "workExperience.current",
        "workExperience.description"
      ])
    );
    expect(educationKeys).toEqual(
      expect.arrayContaining(["education.institution", "education.degree", "education.fieldOfStudy", "education.startDate", "education.endDate"])
    );
  });

  it("surfaces questions, disclosures, login fields, and custom dropdowns for manual review", async () => {
    loadFixture("workday-questions.html");
    const questionFields = await workdayAdapter.scan({ document });
    const questionPlan = await workdayAdapter.buildFillPlan(
      questionFields,
      sampleProfile,
      {},
      "https://example.myworkdayjobs.com/en-US/careers/job/123"
    );
    const questionManualLabels = questionPlan.steps.filter((step) => step.type === "manual").map((step) => step.target.label);

    loadFixture("workday-login.html");
    const loginFields = await workdayAdapter.scan({ document });
    const loginPlan = await workdayAdapter.buildFillPlan(
      loginFields,
      sampleProfile,
      {},
      "https://example.myworkdayjobs.com/en-US/careers/job/123"
    );
    const loginKeys = loginPlan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(questionManualLabels).toEqual(
      expect.arrayContaining([
        "Are you legally authorized to work in this country?",
        "Will you now or in the future require sponsorship?",
        "Preferred office location",
        "Why are you interested in this role?"
      ])
    );
    expect(loginPlan.steps.every((step) => step.type === "manual")).toBe(true);
    expect(loginKeys).not.toContain("personal.email");
  });

  it("does not scan review or assessment challenge pages", async () => {
    loadFixture("workday-review.html");
    expect(await workdayAdapter.scan({ document })).toEqual([]);

    loadFixture("workday-assessment-captcha.html");
    expect(await workdayAdapter.scan({ document })).toEqual([]);
  });

  it("applies site overrides before Workday exact matching", async () => {
    loadFixture("workday-contact.html");
    const fields = await workdayAdapter.scan({ document });
    const plan = await workdayAdapter.buildFillPlan(
      fields,
      sampleProfile,
      {
        siteOverride: siteOverride([
          {
            id: "override-1",
            canonicalKey: "personal.lastName",
            elementSelector: "#firstName",
            label: "First Name",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          }
        ])
      },
      "https://example.myworkdayjobs.com/en-US/careers/job/123"
    );
    const firstNameStep = plan.steps.find((step) => step.target.selector === "#firstName");

    expect(firstNameStep).toEqual(
      expect.objectContaining({
        type: "setText",
        canonicalKey: "personal.lastName",
        value: sampleProfile.personal.lastName
      })
    );
  });
});
