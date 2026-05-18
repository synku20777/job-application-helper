import { detectPlatform } from "@job-helper/dom-utils";
import type { AtsAdapter } from "./baseAdapter";
import { buildFillPlanWithAdapter, executeWithAdapter, scanWithAdapter } from "./pipeline";

export const genericHtmlFormAdapter: AtsAdapter = {
  id: "generic-html-form",
  label: "Generic HTML form",
  priority: 10,
  async detect(context) {
    return detectPlatform(context.url);
  },
  async scan(context) {
    return scanWithAdapter(this, context);
  },
  async buildFillPlan(fields, profile, options, url) {
    return buildFillPlanWithAdapter(this, fields, profile, options, url, {
      adapterId: "generic-html-form",
      label: "Generic form",
      confidence: 0.5
    });
  },
  async executeFillPlan(plan, context, acceptedElementIds) {
    return executeWithAdapter(this, plan, context, acceptedElementIds);
  }
};
