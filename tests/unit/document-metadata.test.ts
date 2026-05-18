import { describe, expect, it } from "vitest";
import { sampleProfile } from "@job-helper/profile-schema";
import { deleteProfileDocument, describeDocumentReference, upsertProfileDocument } from "../../apps/extension/src/profile/documents";

describe("document metadata helpers", () => {
  it("adds and updates document metadata without changing file bytes", () => {
    const withDocument = upsertProfileDocument(sampleProfile, {
      id: "resume_frontend",
      type: "resume",
      label: "Frontend Resume",
      fileName: "frontend-resume.pdf",
      tags: ["frontend"],
      updatedAt: "2026-05-18T00:00:00.000Z"
    });

    expect(withDocument.documents?.find((document) => document.id === "resume_frontend")?.fileName).toBe("frontend-resume.pdf");

    const updated = upsertProfileDocument(withDocument, {
      id: "resume_frontend",
      type: "resume",
      label: "Frontend Resume v2",
      fileName: "frontend-v2.pdf"
    });

    expect(updated.documents?.filter((document) => document.id === "resume_frontend")).toHaveLength(1);
    expect(describeDocumentReference(updated, "resume_frontend")).toContain("Frontend Resume v2");
  });

  it("deletes document metadata by id", () => {
    const withDocument = upsertProfileDocument(sampleProfile, {
      id: "cover_letter",
      type: "coverLetter",
      label: "Cover Letter"
    });

    expect(deleteProfileDocument(withDocument, "cover_letter").documents?.some((document) => document.id === "cover_letter")).toBe(false);
  });
});
