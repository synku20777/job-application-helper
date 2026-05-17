import { buildFillPlanFromMatches, matchFields, matchFieldsWithOverrides } from "@job-helper/autofill-core";
import { executeFillPlan, scanFormFields } from "@job-helper/dom-utils";
import type { CanonicalFieldKey, FieldMatch, FillStep, FormFieldNode, MatchEvidence } from "@job-helper/shared";
import type { AdapterDetectContext, AtsAdapter } from "./baseAdapter";

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

function nodeSearchText(node: FormFieldNode): string {
  return [
    node.id,
    node.name,
    node.selector,
    node.placeholder,
    node.ariaLabel,
    node.ariaLabelledByText,
    node.associatedLabelText,
    node.sectionHeading,
    node.formHeading,
    ...node.nearbyText
  ]
    .filter(Boolean)
    .join(" ");
}

function nodeExactText(node: FormFieldNode): string {
  return [node.id, node.name, node.placeholder, node.ariaLabel, node.ariaLabelledByText, node.associatedLabelText]
    .filter(Boolean)
    .join(" ");
}

function smartRecruitersExactKey(node: FormFieldNode): CanonicalFieldKey | undefined {
  const text = nodeExactText(node);
  return exactSmartRecruitersFields.find((field) => field.patterns.some((pattern) => pattern.test(text)))?.key;
}

function exactMatch(node: FormFieldNode, canonicalKey: CanonicalFieldKey): FieldMatch {
  const evidence: MatchEvidence = {
    type: "exactAdapterSelector",
    text: node.name ?? node.id ?? node.associatedLabelText ?? canonicalKey,
    weight: 1
  };

  return {
    elementId: node.elementId,
    canonicalKey,
    confidence: 1,
    evidence: [evidence],
    adapterId: "smartrecruiters",
    fillable: node.visible && !node.disabled,
    requiresReview: canonicalKey.startsWith("documents."),
    node
  };
}

function isLikelyCustomQuestion(node: FormFieldNode): boolean {
  if (!node.visible || node.disabled) return false;
  if (node.inputType === "hidden" || node.inputType === "submit" || node.inputType === "button") return false;

  const text = nodeSearchText(node);
  return (
    /\bquestion\b/i.test(text) ||
    /\bscreening\b/i.test(text) ||
    /\bjob[_-\s]?specific\b/i.test(text) ||
    /\banswers?\b/i.test(text) ||
    /\bcustom[_-\s]?field/i.test(text)
  );
}

function manualQuestionStep(node: FormFieldNode): FillStep {
  return {
    type: "manual",
    target: {
      elementId: node.elementId,
      selector: node.selector,
      label: node.associatedLabelText ?? node.ariaLabel ?? node.placeholder ?? node.name ?? "SmartRecruiters custom question"
    },
    reason: "SmartRecruiters custom question requires manual review.",
    requiresReview: true
  };
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
  async scan(context) {
    return scanFormFields(context.document);
  },
  async buildFillPlan(fields, profile, options, url) {
    const { overrideMatches, remainingFields } = matchFieldsWithOverrides(fields, "smartrecruiters", options.siteOverride);

    const exactMatches = remainingFields
      .map((field) => {
        const key = smartRecruitersExactKey(field);
        return key ? exactMatch(field, key) : undefined;
      })
      .filter((match): match is FieldMatch => Boolean(match));

    const exactElementIds = new Set(exactMatches.map((match) => match.elementId));
    const customQuestionFields = remainingFields.filter((field) => !exactElementIds.has(field.elementId) && isLikelyCustomQuestion(field));
    const customQuestionElementIds = new Set(customQuestionFields.map((field) => field.elementId));
    const genericMatches = matchFields(
      remainingFields.filter((field) => !exactElementIds.has(field.elementId) && !customQuestionElementIds.has(field.elementId)),
      "smartrecruiters"
    );

    const manualSteps = customQuestionFields.map(manualQuestionStep);

    return buildFillPlanFromMatches(
      [...overrideMatches, ...exactMatches, ...genericMatches],
      profile,
      { adapterId: "smartrecruiters", label: "SmartRecruiters", confidence: 1 },
      url,
      manualSteps
    );
  },
  async executeFillPlan(plan, _context, acceptedElementIds) {
    return executeFillPlan(plan, acceptedElementIds);
  }
};
