import { defineManifest } from "@crxjs/vite-plugin";
import { ATS_HOST_PERMISSIONS } from "./src/background/permissions";

export default defineManifest({
  manifest_version: 3,
  name: "Job Application Autofill",
  version: "0.1.0",
  description: "Local-first job application autofill assistant.",
  permissions: ["storage", "activeTab", "scripting", "sidePanel"],
  optional_host_permissions: [...ATS_HOST_PERMISSIONS],
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
  options_page: "src/sidepanel/index.html"
});
