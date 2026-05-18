import type { CanonicalFieldKey, SerializableFieldCandidate } from "@job-helper/shared";
import type { AdapterDetectContext, AtsAdapter } from "./baseAdapter";
import { buildFillPlanWithAdapter, executeWithAdapter, scanWithAdapter } from "./pipeline";

const exactPersonioFields: Array<{ key: CanonicalFieldKey; patterns: RegExp[] }> = [
  { key: "personal.firstName", patterns: [/\bfirst[_-\s]?name\b/i, /\bgiven[_-\s]?name\b/i] },
  { key: "personal.lastName", patterns: [/\blast[_-\s]?name\b/i, /\bsurname\b/i] },
  { key: "personal.email", patterns: [/\bemail\b/i, /\be-mail\b/i] },
  { key: "personal.phone", patterns: [/\bphone\b/i, /\btelephone\b/i, /\bmobile\b/i] },
  { key: "documents.resume", patterns: [/\bresume\b/i, /\bcv\b/i, /\bcurriculum[_-\s]?vitae\b/i] },
  { key: "documents.coverLetter", patterns: [/\bcover[_-\s]?letter\b/i, /\bmotivation[_-\s]?letter\b/i] },
  { key: "personal.links.linkedin", patterns: [/\blinkedin\b/i] },
  { key: "personal.links.portfolio", patterns: [/\bwebsite\b/i, /\bportfolio\b/i, /\bhomepage\b/i] }
];

function isPersonioHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower.endsWith(".jobs.personio.com") || lower.endsWith(".jobs.personio.de");
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
    /\bfrage\b/i.test(text) ||
    /\bcustom[_-\s]?field/i.test(text) ||
    /\bavailability\b/i.test(text) ||
    /\bavailable[_-\s]?from\b/i.test(text) ||
    /\bnotice[_-\s]?period\b/i.test(text) ||
    /\bverf[üu]gbarkeit\b/i.test(text) ||
    /\bk[üu]ndigungsfrist\b/i.test(text)
  );
}

export const personioAdapter: AtsAdapter = {
  id: "personio",
  label: "Personio",
  priority: 75,
  async detect(context: AdapterDetectContext) {
    if (isPersonioHost(context.hostname)) {
      return { adapterId: "personio", label: "Personio", confidence: 1 };
    }

    if (/personio\.(com|de)/i.test(context.url)) {
      return { adapterId: "personio", label: "Personio", confidence: 0.9 };
    }

    return { adapterId: "generic-html-form", label: "Generic form", confidence: 0.2 };
  },
  getSemanticHints() {
    return {
      fieldBoosts: exactPersonioFields,
      locales: ["de"],
      manualField: (field: SerializableFieldCandidate) =>
        isLikelyCustomQuestion(field) ? { reason: "Personio field requires manual review." } : undefined
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
