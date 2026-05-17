import { buildFillPlan as buildGenericFillPlan } from "@job-helper/autofill-core";
import { detectPlatform, executeFillPlan, scanFormFields } from "@job-helper/dom-utils";
import type { AtsAdapter } from "./baseAdapter";

export const genericHtmlFormAdapter: AtsAdapter = {
  id: "generic-html-form",
  label: "Generic HTML form",
  priority: 10,
  async detect(context) {
    return detectPlatform(context.url);
  },
  async scan(context) {
    return scanFormFields(context.document);
  },
  async buildFillPlan(fields, profile, options, url) {
    return buildGenericFillPlan(fields, profile, { adapterId: "generic-html-form", label: "Generic form", confidence: 0.5 }, url, options);
  },
  async executeFillPlan(plan, _context, acceptedElementIds) {
    return executeFillPlan(plan, acceptedElementIds);
  }
};
