import { describe, expect, it } from "vitest";
import { buildProfileSnippets } from "../../apps/extension/src/linkedin/snippets";
import { isLinkedInUrl, linkedInScanResponse } from "../../apps/extension/src/background/linkedinGuard";
import { sampleProfile } from "@job-helper/profile-schema";

describe("LinkedIn copy assist", () => {
  it("detects LinkedIn URLs without matching lookalike hosts", () => {
    expect(isLinkedInUrl("https://www.linkedin.com/jobs/view/123")).toBe(true);
    expect(isLinkedInUrl("https://linkedin.com/jobs/view/123")).toBe(true);
    expect(isLinkedInUrl("https://www.linkedin.com.evil.test/jobs")).toBe(false);
    expect(isLinkedInUrl("not a url")).toBe(false);
  });

  it("returns a restricted copy-only scan response with no fields", () => {
    const response = linkedInScanResponse("https://www.linkedin.com/jobs/view/123");

    expect(response).toEqual({
      ok: true,
      type: "SCAN_PAGE",
      fields: [],
      platform: {
        adapterId: "linkedin-copy-only",
        label: "LinkedIn copy-assist",
        confidence: 1,
        restricted: true,
        copyOnly: true
      },
      url: "https://www.linkedin.com/jobs/view/123"
    });
  });

  it("builds copyable profile snippets", () => {
    const snippets = buildProfileSnippets(sampleProfile);
    const byId = new Map(snippets.map((snippet) => [snippet.id, snippet.value]));

    expect(byId.get("name")).toBe("John Smith");
    expect(byId.get("email")).toBe("john.smith@example.com");
    expect(byId.get("phone")).toBe("+371 20000000");
    expect(byId.get("linkedin")).toBe("https://www.linkedin.com/in/example");
    expect(byId.get("portfolio")).toBe("https://example.com");
    expect(byId.get("github")).toBe("https://github.com/example");
    expect(byId.get("skills")).toBe("TypeScript, React, Python");
    expect(byId.get("latest-role")).toBe("Software Engineer at Example Company");
    expect(byId.get("work-summary")).toContain("Built internal automation tooling and web applications.");
    expect(byId.get("education-summary")).toContain("University of Latvia");
  });

  it("omits empty optional snippets", () => {
    const snippets = buildProfileSnippets({
      ...sampleProfile,
      personal: {
        ...sampleProfile.personal,
        middleName: undefined,
        links: {}
      },
      skills: [],
      workExperience: [],
      education: []
    });
    const ids = snippets.map((snippet) => snippet.id);

    expect(ids).toEqual(expect.arrayContaining(["name", "email", "phone", "location"]));
    expect(ids).not.toEqual(expect.arrayContaining(["linkedin", "portfolio", "github", "skills", "latest-role", "work-summary", "education-summary"]));
  });
});
