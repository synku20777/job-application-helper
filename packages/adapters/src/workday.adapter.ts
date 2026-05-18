import { normalizeText } from "@job-helper/autofill-core";
import type { CanonicalFieldKey, FieldCandidate, SerializableFieldCandidate } from "@job-helper/shared";
import type { AdapterDetectContext, AtsAdapter } from "./baseAdapter";
import { buildFillPlanWithAdapter, executeWithAdapter, scanWithAdapter } from "./pipeline";

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

const workdayFieldBoosts = [
  ...commonWorkdayFields,
  ...experienceFields.map((field) => ({ ...field, contextPatterns: [/\b(work experience|employment history|experience)\b/i] })),
  ...educationFields.map((field) => ({ ...field, contextPatterns: [/\b(education|school|university)\b/i] }))
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

function contextText(node: SerializableFieldCandidate): string {
  return [node.context.sectionTitle, node.context.formTitle, ...node.context.nearbyText].filter(Boolean).join(" ");
}

function nodeSearchText(node: SerializableFieldCandidate): string {
  return [
    node.id,
    node.dom.name,
    node.dom.id,
    node.dom.placeholder,
    node.accessibility.ariaLabel,
    node.accessibility.ariaLabelledBy,
    node.accessibility.label,
    contextText(node),
    node.dom.selector,
    ...(node.options?.map((option) => option.label) ?? [])
  ]
    .filter(Boolean)
    .join(" ");
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
  getParserHints() {
    return {
      dynamicPage: true,
      waitForMutations: true,
      scanShadowDom: false,
      usesCustomComboboxes: true,
      hasMultiStepFlow: true,
      mutationWaitMs: 1200
    };
  },
  getDriverHints() {
    return {
      preferredComboboxDriver: "ariaComboboxDriver" as const,
      requiresReactInputSetter: true
    };
  },
  getSemanticHints() {
    return {
      fieldBoosts: workdayFieldBoosts,
      manualField: (field: SerializableFieldCandidate) => {
        if (!isManualWorkdayField(field)) return undefined;
        return {
          reason: isUnsupportedDynamicWidget(field)
            ? "Workday custom dropdown requires manual review."
            : "Workday field requires manual review."
        };
      }
    };
  },
  postProcessCandidates(candidates: FieldCandidate[], context) {
    if (!context.document) return candidates;
    const pageState = detectWorkdayPageState(context.document);
    if (pageState === "reviewSubmit" || pageState === "assessmentCaptcha") return [];
    return candidates.filter((field) => field.geometry.visible);
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
