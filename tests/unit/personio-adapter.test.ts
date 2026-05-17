import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { personioAdapter } from "@job-helper/adapters";
import { sampleProfile } from "@job-helper/profile-schema";

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

describe("personioAdapter", () => {
  it("detects hosted Personio .com and .de domains", async () => {
    const dotCom = await personioAdapter.detect({
      url: "https://example.jobs.personio.com/job/123",
      hostname: "example.jobs.personio.com"
    });
    const dotDe = await personioAdapter.detect({
      url: "https://example.jobs.personio.de/job/123",
      hostname: "example.jobs.personio.de"
    });

    expect(dotCom.adapterId).toBe("personio");
    expect(dotCom.confidence).toBe(1);
    expect(dotDe.adapterId).toBe("personio");
    expect(dotDe.confidence).toBe(1);
  });

  it("maps English Personio fields", async () => {
    loadFixture("personio-basic-en.html");
    const fields = await personioAdapter.scan({ document });
    const plan = await personioAdapter.buildFillPlan(fields, sampleProfile, {}, "https://example.jobs.personio.com/job/123");
    const keys = plan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(plan.adapterId).toBe("personio");
    expect(plan.detectedPlatform).toBe("Personio");
    expect(keys).toEqual(expect.arrayContaining(["personal.firstName", "personal.lastName", "personal.phone", "documents.resume"]));
  });

  it("maps German Personio fields", async () => {
    loadFixture("personio-basic-de.html");
    const fields = await personioAdapter.scan({ document });
    const plan = await personioAdapter.buildFillPlan(fields, sampleProfile, {}, "https://example.jobs.personio.de/job/123");
    const keys = plan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(keys).toEqual(expect.arrayContaining(["personal.firstName", "personal.lastName", "personal.phone", "documents.resume"]));
  });

  it("marks CV and cover letter fields as upload/manual steps", async () => {
    loadFixture("personio-uploads.html");
    const fields = await personioAdapter.scan({ document });
    const plan = await personioAdapter.buildFillPlan(fields, profileWithResume, {}, "https://example.jobs.personio.com/job/123");

    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "uploadFile", documentId: "doc_cv_pdf", requiresUserAction: true })
      ])
    );
    expect(plan.steps.some((step) => step.type === "manual" && "canonicalKey" in step && step.canonicalKey === "documents.coverLetter")).toBe(
      true
    );
  });

  it("surfaces availability and custom questions for manual review", async () => {
    loadFixture("personio-availability-custom.html");
    const fields = await personioAdapter.scan({ document });
    const plan = await personioAdapter.buildFillPlan(fields, sampleProfile, {}, "https://example.jobs.personio.com/job/123");
    const manualLabels = plan.steps.filter((step) => step.type === "manual").map((step) => step.target.label);

    expect(manualLabels).toEqual(expect.arrayContaining(["Availability / notice period", "Why do you want to join us?"]));
  });

  it("falls back to generic matching for embedded-style forms", async () => {
    loadFixture("personio-embedded.html");
    const fields = await personioAdapter.scan({ document });
    const plan = await personioAdapter.buildFillPlan(fields, sampleProfile, {}, "https://company.example/jobs/designer");
    const keys = plan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(keys).toEqual(
      expect.arrayContaining(["personal.firstName", "personal.lastName", "personal.email", "personal.links.portfolio"])
    );
  });
});
