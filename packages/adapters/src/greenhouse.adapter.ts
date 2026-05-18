import { buildFillPlanFromMatches, matchFields, matchFieldsWithOverrides } from "@job-helper/autofill-core";
import { executeFillPlan, scanFormFields } from "@job-helper/dom-utils";
import type { CanonicalFieldKey, FieldMatch, FillStep, FieldCandidate, SerializableFieldCandidate, MatchEvidence } from "@job-helper/shared";
import type { AtsAdapter, AdapterDetectContext } from "./baseAdapter";

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

function nodeExactText(node: SerializableFieldCandidate): string {
  return [node.id, node.dom.name, node.dom.placeholder, node.accessibility.ariaLabel, node.accessibility.ariaLabelledBy, node.accessibility.label]
    .filter(Boolean)
    .join(" ");
}

function greenhouseExactKey(node: SerializableFieldCandidate): CanonicalFieldKey | undefined {
  const text = nodeExactText(node);
  return exactGreenhouseFields.find((field) => field.patterns.some((pattern) => pattern.test(text)))?.key;
}

function exactMatch(node: SerializableFieldCandidate, canonicalKey: CanonicalFieldKey): FieldMatch {
  const evidence: MatchEvidence = {
    type: "exactAdapterSelector",
    text: node.dom.name ?? node.id ?? node.accessibility.label ?? canonicalKey,
    weight: 1
  };

  return {
    candidateId: node.id,
    canonicalKey,
    confidence: 1,
    evidence: [evidence],
    adapterId: "greenhouse",
    fillable: node.geometry.visible && !node.state.disabled,
    requiresReview: canonicalKey.startsWith("documents."),
    node
  };
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

function manualQuestionStep(node: SerializableFieldCandidate): FillStep {
  return {
    type: "manual",
    target: {
      candidateId: node.id,
      selector: node.dom.selector ?? "",
      label: node.accessibility.label ?? node.accessibility.ariaLabel ?? node.dom.placeholder ?? node.dom.name ?? "Greenhouse custom question"
    },
    reason: "Greenhouse custom question requires manual review.",
    requiresReview: true
  };
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
  async scan(context) {
    return scanFormFields(context.document);
  },
  async buildFillPlan(fields, profile, options, url) {
    const { overrideMatches, remainingFields } = matchFieldsWithOverrides(fields, "greenhouse", options.siteOverride);

    const exactMatches = remainingFields
      .map((field) => {
        const key = greenhouseExactKey(field);
        return key ? exactMatch(field, key) : undefined;
      })
      .filter((match): match is FieldMatch => Boolean(match));

    const exactElementIds = new Set(exactMatches.map((match) => match.candidateId));
    const customQuestionFields = remainingFields.filter((field) => !exactElementIds.has(field.id) && isLikelyCustomQuestion(field));
    const customQuestionElementIds = new Set(customQuestionFields.map((field) => field.id));
    const genericMatches = matchFields(
      remainingFields.filter((field) => !exactElementIds.has(field.id) && !customQuestionElementIds.has(field.id)),
      "greenhouse",
      { locales: [profile.meta.locale] }
    );

    const manualSteps = customQuestionFields.map(manualQuestionStep);

    return buildFillPlanFromMatches(
      [...overrideMatches, ...exactMatches, ...genericMatches],
      profile,
      { adapterId: "greenhouse", label: "Greenhouse", confidence: 1 },
      url,
      manualSteps
    );
  },
  async executeFillPlan(plan, _context, acceptedElementIds) {
    return executeFillPlan(plan, acceptedElementIds);
  }
};
