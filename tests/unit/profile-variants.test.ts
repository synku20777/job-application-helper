import { describe, expect, it } from "vitest";
import { sampleProfile } from "@job-helper/profile-schema";
import { applyProfileVariant, validateVariantOverrides } from "../../apps/extension/src/storage/profileVariants";
import type { ProfileVariant } from "@job-helper/shared";

function variant(overrides: ProfileVariant["overrides"]): ProfileVariant {
  return {
    variantId: "frontend",
    baseProfileId: sampleProfile.meta.profileId,
    label: "Frontend",
    targetRole: "Frontend Engineer",
    overrides,
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z"
  };
}

describe("profile variants", () => {
  it("applies safe role-specific overrides", () => {
    const effectiveProfile = applyProfileVariant(
      sampleProfile,
      variant({
        skills: ["React", "TypeScript", "Accessibility"],
        links: { portfolio: "https://frontend.example.com" },
        workExperienceDescription: "Built polished frontend workflows.",
        remotePreference: "remote",
        willingToRelocate: true,
        noticePeriod: "2 weeks",
        resumeDocumentId: "frontend_resume"
      })
    );

    expect(effectiveProfile.skills.map((skill) => skill.name)).toEqual(["React", "TypeScript", "Accessibility"]);
    expect(effectiveProfile.personal.links?.portfolio).toBe("https://frontend.example.com");
    expect(effectiveProfile.workExperience[0]?.description).toBe("Built polished frontend workflows.");
    expect(effectiveProfile.applicationDefaults.remotePreference).toBe("remote");
    expect(effectiveProfile.applicationDefaults.willingToRelocate).toBe(true);
    expect(effectiveProfile.applicationDefaults.noticePeriod).toBe("2 weeks");
    expect(effectiveProfile.documents?.find((document) => document.type === "resume")?.id).toBe("frontend_resume");
  });

  it("rejects sensitive or unknown override keys", () => {
    expect(() => validateVariantOverrides({ demographics: { gender: "x" } })).toThrow("demographics is not allowed");
    expect(() => validateVariantOverrides({ sponsorshipRequiredDefault: true })).toThrow("sponsorshipRequiredDefault is not allowed");
    expect(() => validateVariantOverrides({ skills: ["React"] })).not.toThrow();
  });
});
