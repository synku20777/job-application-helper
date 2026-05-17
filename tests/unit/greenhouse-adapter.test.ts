import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { greenhouseAdapter } from "@job-helper/adapters";
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

describe("greenhouseAdapter", () => {
  it("detects hosted Greenhouse domains", async () => {
    const detection = await greenhouseAdapter.detect({
      url: "https://boards.greenhouse.io/example/jobs/123",
      hostname: "boards.greenhouse.io"
    });
    expect(detection.adapterId).toBe("greenhouse");
    expect(detection.confidence).toBe(1);
  });

  it("maps standard Greenhouse fields with exact adapter matches", async () => {
    loadFixture("greenhouse-basic.html");
    const fields = await greenhouseAdapter.scan({ document });
    const plan = await greenhouseAdapter.buildFillPlan(fields, sampleProfile, {}, "https://boards.greenhouse.io/example/jobs/123");
    const keys = plan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(plan.adapterId).toBe("greenhouse");
    expect(plan.detectedPlatform).toBe("Greenhouse");
    expect(keys).toEqual(expect.arrayContaining(["personal.firstName", "personal.lastName", "personal.email", "personal.phone"]));
  });

  it("marks resume and cover letter fields as upload steps", async () => {
    loadFixture("greenhouse-uploads.html");
    const fields = await greenhouseAdapter.scan({ document });
    const plan = await greenhouseAdapter.buildFillPlan(fields, profileWithResume, {}, "https://boards.greenhouse.io/example/jobs/123");

    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "uploadFile", documentId: "doc_cv_pdf", requiresUserAction: true })
      ])
    );
    expect(plan.steps.some((step) => step.type === "manual" && "canonicalKey" in step && step.canonicalKey === "documents.coverLetter")).toBe(
      true
    );
  });

  it("surfaces unmatched Greenhouse custom questions for manual review", async () => {
    loadFixture("greenhouse-custom-questions.html");
    const fields = await greenhouseAdapter.scan({ document });
    const plan = await greenhouseAdapter.buildFillPlan(fields, sampleProfile, {}, "https://boards.greenhouse.io/example/jobs/123");
    const manualLabels = plan.steps
      .filter((step) => step.type === "manual")
      .map((step) => step.target.label);

    expect(manualLabels).toEqual(expect.arrayContaining(["Why do you want to work here?", "Preferred office location"]));
  });

  it("falls back to generic matching for embedded-style forms", async () => {
    loadFixture("greenhouse-embedded.html");
    const fields = await greenhouseAdapter.scan({ document });
    const plan = await greenhouseAdapter.buildFillPlan(fields, sampleProfile, {}, "https://company.example/jobs/designer");
    const keys = plan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(keys).toEqual(expect.arrayContaining(["personal.firstName", "personal.lastName", "personal.email"]));
  });
});
