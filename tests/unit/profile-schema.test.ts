import { describe, expect, it } from "vitest";
import { candidateProfileSchema, sampleProfile } from "@job-helper/profile-schema";

describe("candidateProfileSchema", () => {
  it("accepts the sample profile", () => {
    expect(candidateProfileSchema.parse(sampleProfile).meta.profileId).toBe("default");
  });

  it("rejects malformed profile JSON", () => {
    expect(() => candidateProfileSchema.parse({ ...sampleProfile, personal: { email: "nope" } })).toThrow();
  });
});
