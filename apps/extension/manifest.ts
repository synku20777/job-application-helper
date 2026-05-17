import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Job Application Autofill",
  version: "0.1.0",
  description: "Local-first job application autofill assistant.",
  permissions: ["storage", "activeTab", "scripting", "sidePanel"],
  optional_host_permissions: [
    "https://*.myworkdayjobs.com/*",
    "https://jobs.smartrecruiters.com/*",
    "https://careers.smartrecruiters.com/*",
    "https://boards.greenhouse.io/*",
    "https://job-boards.greenhouse.io/*",
    "https://*.jobs.personio.com/*",
    "https://*.jobs.personio.de/*"
  ],
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  action: {
    default_popup: "src/popup/index.html"
  },
  side_panel: {
    default_path: "src/sidepanel/index.html"
  },
  options_page: "src/sidepanel/index.html",
  content_scripts: [
    {
      matches: [
        "https://*.myworkdayjobs.com/*",
        "https://jobs.smartrecruiters.com/*",
        "https://careers.smartrecruiters.com/*",
        "https://boards.greenhouse.io/*",
        "https://job-boards.greenhouse.io/*",
        "https://*.jobs.personio.com/*",
        "https://*.jobs.personio.de/*"
      ],
      js: ["src/content/index.ts"],
      run_at: "document_idle"
    }
  ]
});
