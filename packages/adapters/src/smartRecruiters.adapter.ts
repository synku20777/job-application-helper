import type { CanonicalFieldKey, SerializableFieldCandidate } from "@job-helper/shared";
import type { AdapterDetectContext, AtsAdapter } from "./baseAdapter";
import { buildFillPlanWithAdapter, executeWithAdapter, scanWithAdapter } from "./pipeline";

const smartRecruitersHosts = new Set(["jobs.smartrecruiters.com", "careers.smartrecruiters.com"]);

const exactSmartRecruitersFields: Array<{ key: CanonicalFieldKey; patterns: RegExp[] }> = [
  { key: "personal.firstName", patterns: [/\bfirst[_-\s]?name\b/i, /\bgiven[_-\s]?name\b/i, /\bfirstName\b/i] },
  { key: "personal.lastName", patterns: [/\blast[_-\s]?name\b/i, /\bsurname\b/i, /\blastName\b/i] },
  { key: "personal.email", patterns: [/\bemail\b/i, /\be-mail\b/i] },
  { key: "personal.phone", patterns: [/\bphone\b/i, /\bmobile\b/i, /\btelephone\b/i] },
  { key: "personal.address.line1", patterns: [/\baddress\b/i, /\bstreet\b/i, /\baddressLine1\b/i] },
  { key: "personal.address.city", patterns: [/\bcity\b/i] },
  { key: "personal.address.region", patterns: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i] },
  { key: "personal.address.postalCode", patterns: [/\bpostal[_-\s]?code\b/i, /\bzip[_-\s]?code\b/i, /\bpostcode\b/i] },
  { key: "personal.address.country", patterns: [/\bcountry\b/i] },
  { key: "documents.resume", patterns: [/\bresume\b/i, /\bcv\b/i, /\bcurriculum[_-\s]?vitae\b/i] },
  { key: "documents.coverLetter", patterns: [/\bcover[_-\s]?letter\b/i, /\bmotivation[_-\s]?letter\b/i] },
  { key: "personal.links.linkedin", patterns: [/\blinkedin\b/i] },
  { key: "personal.links.portfolio", patterns: [/\bwebsite\b/i, /\bportfolio\b/i, /\bpersonal[_-\s]?site\b/i] }
];

function isSmartRecruitersHost(hostname: string): boolean {
  return smartRecruitersHosts.has(hostname.toLowerCase());
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
    /\bscreening\b/i.test(text) ||
    /\bjob[_-\s]?specific\b/i.test(text) ||
    /\banswers?\b/i.test(text) ||
    /\bcustom[_-\s]?field/i.test(text)
  );
}

export const smartRecruitersAdapter: AtsAdapter = {
  id: "smartrecruiters",
  label: "SmartRecruiters",
  priority: 80,
  async detect(context: AdapterDetectContext) {
    if (isSmartRecruitersHost(context.hostname)) {
      return { adapterId: "smartrecruiters", label: "SmartRecruiters", confidence: 1 };
    }

    if (/smartrecruiters\.com/i.test(context.url)) {
      return { adapterId: "smartrecruiters", label: "SmartRecruiters", confidence: 0.9 };
    }

    return { adapterId: "generic-html-form", label: "Generic form", confidence: 0.2 };
  },
  getSemanticHints() {
    return {
      fieldBoosts: exactSmartRecruitersFields,
      manualField: (field: SerializableFieldCandidate) =>
        isLikelyCustomQuestion(field) ? { reason: "SmartRecruiters custom question requires manual review." } : undefined
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
