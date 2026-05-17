import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { smartRecruitersAdapter } from "@job-helper/adapters";
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

describe("smartRecruitersAdapter", () => {
  it("detects hosted SmartRecruiters domains", async () => {
    const detection = await smartRecruitersAdapter.detect({
      url: "https://jobs.smartrecruiters.com/example/123-designer",
      hostname: "jobs.smartrecruiters.com"
    });
    expect(detection.adapterId).toBe("smartrecruiters");
    expect(detection.confidence).toBe(1);
  });

  it("maps standard SmartRecruiters fields with exact adapter matches", async () => {
    loadFixture("smartrecruiters-basic.html");
    const fields = await smartRecruitersAdapter.scan({ document });
    const plan = await smartRecruitersAdapter.buildFillPlan(
      fields,
      sampleProfile,
      {},
      "https://jobs.smartrecruiters.com/example/123-designer"
    );
    const keys = plan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(plan.adapterId).toBe("smartrecruiters");
    expect(plan.detectedPlatform).toBe("SmartRecruiters");
    expect(keys).toEqual(
      expect.arrayContaining(["personal.firstName", "personal.lastName", "personal.email", "personal.phone", "personal.links.portfolio"])
    );
  });

  it("marks resume and cover letter fields as upload/manual steps", async () => {
    loadFixture("smartrecruiters-uploads.html");
    const fields = await smartRecruitersAdapter.scan({ document });
    const plan = await smartRecruitersAdapter.buildFillPlan(
      fields,
      profileWithResume,
      {},
      "https://jobs.smartrecruiters.com/example/123-designer"
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

  it("maps address fields", async () => {
    loadFixture("smartrecruiters-address.html");
    const fields = await smartRecruitersAdapter.scan({ document });
    const plan = await smartRecruitersAdapter.buildFillPlan(
      fields,
      sampleProfile,
      {},
      "https://jobs.smartrecruiters.com/example/123-designer"
    );
    const keys = plan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(keys).toEqual(
      expect.arrayContaining([
        "personal.address.line1",
        "personal.address.city",
        "personal.address.region",
        "personal.address.postalCode",
        "personal.address.country"
      ])
    );
  });

  it("surfaces unmatched SmartRecruiters custom questions for manual review", async () => {
    loadFixture("smartrecruiters-custom-questions.html");
    const fields = await smartRecruitersAdapter.scan({ document });
    const plan = await smartRecruitersAdapter.buildFillPlan(
      fields,
      sampleProfile,
      {},
      "https://jobs.smartrecruiters.com/example/123-designer"
    );
    const manualLabels = plan.steps.filter((step) => step.type === "manual").map((step) => step.target.label);

    expect(manualLabels).toEqual(expect.arrayContaining(["Why are you interested in this role?", "When can you start?"]));
  });

  it("supports step-like rescans by planning the currently visible form", async () => {
    loadFixture("smartrecruiters-step-contact.html");
    const contactFields = await smartRecruitersAdapter.scan({ document });
    const contactPlan = await smartRecruitersAdapter.buildFillPlan(
      contactFields,
      sampleProfile,
      {},
      "https://jobs.smartrecruiters.com/example/123-designer"
    );
    const contactKeys = contactPlan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    loadFixture("smartrecruiters-step-profile.html");
    const profileFields = await smartRecruitersAdapter.scan({ document });
    const profilePlan = await smartRecruitersAdapter.buildFillPlan(
      profileFields,
      profileWithResume,
      {},
      "https://jobs.smartrecruiters.com/example/123-designer"
    );
    const profileKeys = profilePlan.steps.flatMap((step) => ("canonicalKey" in step && step.canonicalKey ? [step.canonicalKey] : []));

    expect(contactKeys).toEqual(expect.arrayContaining(["personal.firstName", "personal.lastName", "personal.email"]));
    expect(profileKeys).toEqual(expect.arrayContaining(["personal.phone", "personal.links.portfolio"]));
    expect(profilePlan.steps).toEqual(expect.arrayContaining([expect.objectContaining({ type: "uploadFile" })]));
  });
});
