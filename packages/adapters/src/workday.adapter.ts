import { buildFillPlanFromMatches, isSensitiveField, matchFields, matchFieldsWithOverrides, normalizeText } from "@job-helper/autofill-core";
import { executeFillPlan, scanFormFields } from "@job-helper/dom-utils";
import type { CanonicalFieldKey, FieldMatch, FillStep, FieldCandidate, SerializableFieldCandidate, MatchEvidence } from "@job-helper/shared";
import type { AdapterDetectContext, AtsAdapter } from "./baseAdapter";

export type WorkdayPageState = "applicationForm" | "loginAccount" | "reviewSubmit" | "assessmentCaptcha" | "unknown";
export type WorkdayStepKind = "contact" | "documents" | "experience" | "education" | "questionsDisclosures" | "review" | "unknown";

const workdayHostPattern = /(^|\.)myworkdayjobs\.com$/i;

const commonWorkdayFields: Array<{ key: CanonicalFieldKey; patterns: RegExp[] }> = [
  { key: "personal.firstName", patterns: [/\bfirst[_-\s]?name\b/i, /\bgiven[_-\s]?name\b/i, /\blegal[_-\s]?first[_-\s]?name\b/i] },
  { key: "personal.middleName", patterns: [/\bmiddle[_-\s]?name\b/i] },
  { key: "personal.lastName", patterns: [/\blast[_-\s]?name\b/i, /\bfamily[_-\s]?name\b/i, /\bsurname\b/i] },
  { key: "personal.email", patterns: [/\bemail\b/i, /\be-mail\b/i] },
  { key: "personal.phone", patterns: [/\bphone\b/i, /\bmobile\b/i, /\btelephone\b/i] },
  { key: "personal.address.line1", patterns: [/\baddress[_-\s]?line[_-\s]?1\b/i, /\bstreet[_-\s]?address\b/i, /\baddress\b/i] },
  { key: "personal.address.city", patterns: [/\bcity\b/i, /\btown\b/i] },
  { key: "personal.address.region", patterns: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i] },
  { key: "personal.address.postalCode", patterns: [/\bpostal[_-\s]?code\b/i, /\bzip[_-\s]?code\b/i, /\bpostcode\b/i] },
  { key: "personal.address.country", patterns: [/\bcountry\b/i] },
  { key: "personal.links.linkedin", patterns: [/\blinkedin\b/i] },
  { key: "personal.links.portfolio", patterns: [/\bportfolio\b/i, /\bwebsite\b/i, /\bpersonal[_-\s]?site\b/i] },
  { key: "documents.resume", patterns: [/\bresume\b/i, /\bcv\b/i, /\bcurriculum[_-\s]?vitae\b/i] },
  { key: "documents.coverLetter", patterns: [/\bcover[_-\s]?letter\b/i, /\bmotivation[_-\s]?letter\b/i] }
];

const experienceFields: Array<{ key: CanonicalFieldKey; patterns: RegExp[] }> = [
  { key: "workExperience.company", patterns: [/\bcompany\b/i, /\bemployer\b/i, /\borganization\b/i, /\borganisation\b/i] },
  { key: "workExperience.title", patterns: [/\bjob[_-\s]?title\b/i, /\bposition\b/i, /\brole\b/i, /^title$/i] },
  { key: "workExperience.location", patterns: [/\blocation\b/i, /\bwork[_-\s]?location\b/i] },
  { key: "workExperience.startDate", patterns: [/\bstart[_-\s]?date\b/i, /\bfrom\b/i] },
  { key: "workExperience.endDate", patterns: [/\bend[_-\s]?date\b/i, /\bto\b/i] },
  { key: "workExperience.current", patterns: [/\bcurrently[_-\s]?work\b/i, /\bcurrent[_-\s]?role\b/i, /\bpresent\b/i] },
  { key: "workExperience.description", patterns: [/\bdescription\b/i, /\bresponsibilities\b/i, /\bachievements\b/i] }
];

const educationFields: Array<{ key: CanonicalFieldKey; patterns: RegExp[] }> = [
  { key: "education.institution", patterns: [/\bschool\b/i, /\buniversity\b/i, /\binstitution\b/i, /\bcollege\b/i] },
  { key: "education.degree", patterns: [/\bdegree\b/i, /\bqualification\b/i] },
  { key: "education.fieldOfStudy", patterns: [/\bfield[_-\s]?of[_-\s]?study\b/i, /\bmajor\b/i, /\bsubject\b/i] },
  { key: "education.startDate", patterns: [/\bstart[_-\s]?date\b/i, /\bfrom\b/i] },
  { key: "education.endDate", patterns: [/\bend[_-\s]?date\b/i, /\bgraduation[_-\s]?date\b/i, /\bto\b/i] }
];

function isWorkdayHost(hostname: string): boolean {
  return workdayHostPattern.test(hostname.toLowerCase());
}

function bodyText(document: Document): string {
  return normalizeText(document.body?.textContent ?? "");
}

export function detectWorkdayPageState(document: Document): WorkdayPageState {
  const text = bodyText(document);
  if (/\b(captcha|recaptcha|assessment|challenge|verification code|security check)\b/i.test(text)) return "assessmentCaptcha";
  if (/\b(sign in|log in|login|create account|password|forgot password|username)\b/i.test(text)) return "loginAccount";
  if (/\b(review and submit|review application|submit application|application summary)\b/i.test(text)) return "reviewSubmit";
  if (/\b(my information|contact information|resume|cv|work experience|employment history|education|application questions|voluntary disclosures)\b/i.test(text)) {
    return "applicationForm";
  }
  return "unknown";
}

export function detectWorkdayStepKind(document: Document): WorkdayStepKind {
  const text = bodyText(document);
  if (/\b(review and submit|review application|submit application|application summary)\b/i.test(text)) return "review";
  if (/\b(application questions|questionnaire|screening questions|voluntary disclosures|disclosures)\b/i.test(text)) return "questionsDisclosures";
  if (/\b(work experience|employment history|experience)\b/i.test(text)) return "experience";
  if (/\b(education|school|university)\b/i.test(text)) return "education";
  if (/\b(resume|cv|cover letter|documents|upload)\b/i.test(text)) return "documents";
  if (/\b(my information|contact information|personal information|address)\b/i.test(text)) return "contact";
  return "unknown";
}

function directNodeText(node: SerializableFieldCandidate): string {
  return [node.id, node.dom.name, node.dom.placeholder, node.accessibility.ariaLabel, node.accessibility.ariaLabelledBy, node.accessibility.label]
    .filter(Boolean)
    .join(" ");
}

function contextText(node: SerializableFieldCandidate): string {
  return [node.context.sectionTitle, node.context.formTitle, ...node.context.nearbyText].filter(Boolean).join(" ");
}

function nodeSearchText(node: SerializableFieldCandidate): string {
  return [directNodeText(node), contextText(node), node.dom.selector, ...(node.options ?? [])].filter(Boolean).join(" ");
}

function firstPatternMatch(node: SerializableFieldCandidate, fields: Array<{ key: CanonicalFieldKey; patterns: RegExp[] }>): CanonicalFieldKey | undefined {
  const text = directNodeText(node);
  return fields.find((field) => field.patterns.some((pattern) => pattern.test(text)))?.key;
}

function workdayExactKey(node: SerializableFieldCandidate): CanonicalFieldKey | undefined {
  const context = contextText(node);
  if (/\b(education|school|university)\b/i.test(context)) {
    const key = firstPatternMatch(node, educationFields);
    if (key) return key;
  }
  if (/\b(work experience|employment history|experience)\b/i.test(context)) {
    const key = firstPatternMatch(node, experienceFields);
    if (key) return key;
  }

  return firstPatternMatch(node, commonWorkdayFields);
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
    adapterId: "workday",
    fillable: node.geometry.visible && !node.state.disabled,
    requiresReview: canonicalKey.startsWith("documents.") || isSensitiveField(canonicalKey),
    node
  };
}

function targetFor(node: SerializableFieldCandidate, fallbackLabel: string) {
  return {
    candidateId: node.id,
    selector: node.dom.selector ?? "",
    label: node.accessibility.label ?? node.accessibility.ariaLabel ?? node.accessibility.ariaLabelledBy ?? node.dom.placeholder ?? node.dom.name ?? fallbackLabel
  };
}

function isButtonLike(node: SerializableFieldCandidate): boolean {
  return node.dom.type === "hidden" || node.dom.type === "submit" || node.dom.type === "button";
}

function isUnsupportedDynamicWidget(node: SerializableFieldCandidate): boolean {
  return node.dom.role === "combobox" && node.dom.tagName !== "select";
}

function isManualWorkdayField(node: SerializableFieldCandidate): boolean {
  if (!node.geometry.visible || node.state.disabled || isButtonLike(node)) return false;
  if (isUnsupportedDynamicWidget(node)) return true;

  const text = nodeSearchText(node);
  return (
    /\b(sign in|log in|login|create account|password|username|forgot password)\b/i.test(text) ||
    /\b(question|questionnaire|screening|disclosure|voluntary disclosure)\b/i.test(text) ||
    /\b(gender|veteran|disability|ethnicity|race|criminal|conviction|sponsorship|work authorization)\b/i.test(text) ||
    /\b(captcha|recaptcha|assessment|challenge|verification code)\b/i.test(text)
  );
}

function manualWorkdayStep(node: SerializableFieldCandidate): FillStep {
  return {
    type: "manual",
    target: targetFor(node, "Workday field"),
    reason: isUnsupportedDynamicWidget(node)
      ? "Workday custom dropdown requires manual review."
      : "Workday field requires manual review.",
    requiresReview: true
  };
}

export const workdayAdapter: AtsAdapter = {
  id: "workday",
  label: "Workday",
  priority: 90,
  async detect(context: AdapterDetectContext) {
    if (isWorkdayHost(context.hostname)) {
      return { adapterId: "workday", label: "Workday", confidence: 1 };
    }

    if (/myworkdayjobs\.com/i.test(context.url)) {
      return { adapterId: "workday", label: "Workday", confidence: 0.9 };
    }

    return { adapterId: "generic-html-form", label: "Generic form", confidence: 0.2 };
  },
  async scan(context) {
    const pageState = detectWorkdayPageState(context.document);
    if (pageState === "reviewSubmit" || pageState === "assessmentCaptcha") return [];
    return scanFormFields(context.document).filter((field) => field.geometry.visible);
  },
  async buildFillPlan(fields, profile, options, url) {
    const { overrideMatches, remainingFields } = matchFieldsWithOverrides(fields, "workday", options.siteOverride);
    const manualFields = remainingFields.filter(isManualWorkdayField);
    const manualElementIds = new Set(manualFields.map((field) => field.id));
    const matchableFields = remainingFields.filter((field) => !manualElementIds.has(field.id));

    const exactMatches = matchableFields
      .filter((field) => !isUnsupportedDynamicWidget(field))
      .map((field) => {
        const key = workdayExactKey(field);
        return key ? exactMatch(field, key) : undefined;
      })
      .filter((match): match is FieldMatch => Boolean(match));

    const exactElementIds = new Set(exactMatches.map((match) => match.candidateId));
    const genericMatches = matchFields(
      matchableFields.filter((field) => !exactElementIds.has(field.id)),
      "workday",
      { locales: [profile.meta.locale] }
    );

    return buildFillPlanFromMatches(
      [...overrideMatches, ...exactMatches, ...genericMatches],
      profile,
      { adapterId: "workday", label: "Workday", confidence: 1 },
      url,
      manualFields.map(manualWorkdayStep)
    );
  },
  async executeFillPlan(plan, _context, acceptedElementIds) {
    return executeFillPlan(plan, acceptedElementIds);
  }
};
