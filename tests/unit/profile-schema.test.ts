import { describe, expect, it } from "vitest";
import { candidateProfileSchema, sampleProfile } from "@job-helper/profile-schema";

describe("candidateProfileSchema", () => {
  it("accepts the sample profile", () => {
    expect(candidateProfileSchema.parse(sampleProfile).meta.profileId).toBe("default");
  });

  it("rejects malformed profile JSON", () => {
    expect(() => candidateProfileSchema.parse({ ...sampleProfile, personal: { email: "nope" } })).toThrow();
  });

  it("accepts optional document metadata", () => {
    const parsed = candidateProfileSchema.parse({
      ...sampleProfile,
      documents: [
        {
          id: "resume_frontend",
          type: "resume",
          label: "Frontend Resume",
          fileName: "frontend-resume.pdf",
          mimeType: "application/pdf",
          description: "Frontend-focused resume",
          targetRole: "Frontend Engineer",
          updatedAt: "2026-05-18T00:00:00.000Z",
          tags: ["frontend", "react"]
        }
      ]
    });

    expect(parsed.documents?.[0]?.targetRole).toBe("Frontend Engineer");
  });
});
