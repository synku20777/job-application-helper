import type { CanonicalFieldKey, SerializableFieldCandidate } from "@job-helper/shared";
import type { AtsAdapter, AdapterDetectContext } from "./baseAdapter";
import { buildFillPlanWithAdapter, executeWithAdapter, scanWithAdapter } from "./pipeline";

const greenhouseHosts = new Set(["boards.greenhouse.io", "job-boards.greenhouse.io"]);

const exactGreenhouseFields: Array<{ key: CanonicalFieldKey; patterns: RegExp[] }> = [
  { key: "personal.firstName", patterns: [/\bfirst[_-\s]?name\b/i, /\[first_name\]/i] },
  { key: "personal.lastName", patterns: [/\blast[_-\s]?name\b/i, /\[last_name\]/i] },
  { key: "personal.email", patterns: [/\bemail\b/i, /\[email\]/i] },
  { key: "personal.phone", patterns: [/\bphone\b/i, /\[phone\]/i] },
  { key: "documents.resume", patterns: [/\bresume\b/i, /\bcv\b/i, /\[resume\]/i] },
  { key: "documents.coverLetter", patterns: [/\bcover[_-\s]?letter\b/i, /\[cover_letter\]/i] },
  { key: "personal.links.linkedin", patterns: [/\blinkedin\b/i] },
  { key: "personal.links.portfolio", patterns: [/\bwebsite\b/i, /\bportfolio\b/i, /\bpersonal[_-\s]?site\b/i] }
];

function isGreenhouseHost(hostname: string): boolean {
  return greenhouseHosts.has(hostname.toLowerCase());
}

function nodeSearchText(node: SerializableFieldCandidate): string {
  return [
    node.id,
    node.dom.name,
    node.dom.selector,
    node.dom.placeholder,
    node.accessibility.ariaLabel,
    node.accessibility.ariaLabelledBy,
    node.accessibility.label,
    node.context.sectionTitle,
    node.context.formTitle,
    ...node.context.nearbyText
  ]
    .filter(Boolean)
    .join(" ");
}

function isLikelyCustomQuestion(node: SerializableFieldCandidate): boolean {
  if (!node.geometry.visible || node.state.disabled) return false;
  if (node.dom.type === "hidden" || node.dom.type === "submit" || node.dom.type === "button") return false;

  const text = nodeSearchText(node);
  return (
    /\bquestion\b/i.test(text) ||
    /\bcustom[_-\s]?field/i.test(text) ||
    /\bjob_application\[answers_attributes\]/i.test(text) ||
    /\bjob_application\[custom_fields\]/i.test(text)
  );
}

export const greenhouseAdapter: AtsAdapter = {
  id: "greenhouse",
  label: "Greenhouse",
  priority: 80,
  async detect(context: AdapterDetectContext) {
    if (isGreenhouseHost(context.hostname)) {
      return { adapterId: "greenhouse", label: "Greenhouse", confidence: 1 };
    }

    if (/greenhouse\.io/i.test(context.url)) {
      return { adapterId: "greenhouse", label: "Greenhouse", confidence: 0.9 };
    }

    return { adapterId: "generic-html-form", label: "Generic form", confidence: 0.2 };
  },
  getSemanticHints() {
    return {
      fieldBoosts: exactGreenhouseFields,
      manualField: (field: SerializableFieldCandidate) =>
        isLikelyCustomQuestion(field) ? { reason: "Greenhouse custom question requires manual review." } : undefined
    };
  },
  async scan(context) {
    return scanWithAdapter(this, context);
  },
  async buildFillPlan(fields, profile, options, url) {
    return buildFillPlanWithAdapter(this, fields, profile, options, url);
  },
  async executeFillPlan(plan, context, acceptedElementIds) {
    return executeWithAdapter(this, plan, context, acceptedElementIds);
  }
};
