import { describe, expect, it } from "vitest";
import { isLinkedInUrl } from "../../apps/extension/src/background/linkedinGuard";
import { optionalHostPermissionForUrl } from "../../apps/extension/src/background/permissions";

describe("compliance helpers", () => {
  it("does not request LinkedIn host permissions", () => {
    expect(isLinkedInUrl("https://www.linkedin.com/jobs/view/123")).toBe(true);
    expect(optionalHostPermissionForUrl("https://www.linkedin.com/jobs/view/123")).toBeNull();
  });

  it("maps supported ATS pages to narrow optional host permissions", () => {
    expect(optionalHostPermissionForUrl("https://example.myworkdayjobs.com/en-US/job/123")).toBe("https://*.myworkdayjobs.com/*");
    expect(optionalHostPermissionForUrl("https://jobs.smartrecruiters.com/example/123")).toBe("https://jobs.smartrecruiters.com/*");
    expect(optionalHostPermissionForUrl("https://careers.smartrecruiters.com/example/123")).toBe("https://careers.smartrecruiters.com/*");
    expect(optionalHostPermissionForUrl("https://boards.greenhouse.io/example/jobs/123")).toBe("https://boards.greenhouse.io/*");
    expect(optionalHostPermissionForUrl("https://job-boards.greenhouse.io/example/jobs/123")).toBe("https://job-boards.greenhouse.io/*");
    expect(optionalHostPermissionForUrl("https://example.jobs.personio.com/job/123")).toBe("https://*.jobs.personio.com/*");
    expect(optionalHostPermissionForUrl("https://example.jobs.personio.de/job/123")).toBe("https://*.jobs.personio.de/*");
  });

  it("does not require optional host permission for local fixtures or unsupported hosts", () => {
    expect(optionalHostPermissionForUrl("http://localhost:5173/fixtures/generic-form.html")).toBeNull();
    expect(optionalHostPermissionForUrl("https://example.com/jobs/123")).toBeNull();
    expect(optionalHostPermissionForUrl("not a url")).toBeNull();
  });
});
