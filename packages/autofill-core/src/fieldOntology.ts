import type { CanonicalFieldKey, SectionType } from "@job-helper/shared";
import { resolveEffectiveSynonyms } from "./labelDictionaries";

export type CanonicalValueType = "string" | "email" | "phone" | "boolean" | "option" | "file" | "date" | "list";
export type FieldSensitivity = "normal" | "sensitive";

export type CanonicalFieldDefinition = {
  labels: string[];
  negativeLabels?: string[];
  valueType: CanonicalValueType;
  sensitivity: FieldSensitivity;
  sectionTypes?: SectionType[];
  autocomplete?: string[];
};

export type CanonicalFieldOntology = Record<CanonicalFieldKey, CanonicalFieldDefinition>;

const labels = resolveEffectiveSynonyms();

export const canonicalFieldOntology: CanonicalFieldOntology = {
  "personal.firstName": {
    labels: labels["personal.firstName"],
    negativeLabels: ["preferred first name", "reference first name", "manager first name", "emergency contact first name"],
    valueType: "string",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["given-name"]
  },
  "personal.middleName": {
    labels: labels["personal.middleName"],
    valueType: "string",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["additional-name"]
  },
  "personal.lastName": {
    labels: labels["personal.lastName"],
    negativeLabels: ["reference last name", "manager last name", "emergency contact last name"],
    valueType: "string",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["family-name"]
  },
  "personal.email": {
    labels: labels["personal.email"],
    negativeLabels: ["reference email", "manager email", "emergency contact email"],
    valueType: "email",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["email"]
  },
  "personal.phone": {
    labels: labels["personal.phone"],
    negativeLabels: ["reference phone", "manager phone", "emergency contact phone"],
    valueType: "phone",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["tel", "tel-national"]
  },
  "personal.address.line1": {
    labels: labels["personal.address.line1"],
    valueType: "string",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["street-address", "address-line1"]
  },
  "personal.address.city": {
    labels: labels["personal.address.city"],
    valueType: "string",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["address-level2"]
  },
  "personal.address.region": {
    labels: labels["personal.address.region"],
    valueType: "string",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["address-level1"]
  },
  "personal.address.postalCode": {
    labels: labels["personal.address.postalCode"],
    valueType: "string",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["postal-code"]
  },
  "personal.address.country": {
    labels: labels["personal.address.country"],
    valueType: "string",
    sensitivity: "normal",
    sectionTypes: ["personal"],
    autocomplete: ["country", "country-name"]
  },
  "personal.links.linkedin": { labels: labels["personal.links.linkedin"], valueType: "string", sensitivity: "normal", sectionTypes: ["personal"] },
  "personal.links.github": { labels: labels["personal.links.github"], valueType: "string", sensitivity: "normal", sectionTypes: ["personal"] },
  "personal.links.portfolio": { labels: labels["personal.links.portfolio"], valueType: "string", sensitivity: "normal", sectionTypes: ["personal"] },
  "demographics.gender": { labels: labels["demographics.gender"], valueType: "option", sensitivity: "sensitive", sectionTypes: ["demographics"] },
  "demographics.pronouns": { labels: labels["demographics.pronouns"], valueType: "string", sensitivity: "sensitive", sectionTypes: ["demographics"] },
  "workExperience.company": {
    labels: labels["workExperience.company"],
    negativeLabels: ["current company size", "reference company"],
    valueType: "string",
    sensitivity: "normal",
    sectionTypes: ["experience"]
  },
  "workExperience.title": { labels: labels["workExperience.title"], valueType: "string", sensitivity: "normal", sectionTypes: ["experience"] },
  "workExperience.location": { labels: labels["workExperience.location"], valueType: "string", sensitivity: "normal", sectionTypes: ["experience"] },
  "workExperience.startDate": { labels: labels["workExperience.startDate"], valueType: "date", sensitivity: "normal", sectionTypes: ["experience"] },
  "workExperience.endDate": { labels: labels["workExperience.endDate"], valueType: "date", sensitivity: "normal", sectionTypes: ["experience"] },
  "workExperience.current": { labels: labels["workExperience.current"], valueType: "boolean", sensitivity: "normal", sectionTypes: ["experience"] },
  "workExperience.description": { labels: labels["workExperience.description"], valueType: "string", sensitivity: "normal", sectionTypes: ["experience"] },
  "education.institution": { labels: labels["education.institution"], valueType: "string", sensitivity: "normal", sectionTypes: ["education"] },
  "education.degree": { labels: labels["education.degree"], valueType: "string", sensitivity: "normal", sectionTypes: ["education"] },
  "education.fieldOfStudy": { labels: labels["education.fieldOfStudy"], valueType: "string", sensitivity: "normal", sectionTypes: ["education"] },
  "education.startDate": { labels: labels["education.startDate"], valueType: "date", sensitivity: "normal", sectionTypes: ["education"] },
  "education.endDate": { labels: labels["education.endDate"], valueType: "date", sensitivity: "normal", sectionTypes: ["education"] },
  skills: { labels: labels.skills, valueType: "list", sensitivity: "normal", sectionTypes: ["skills"] },
  languages: { labels: labels.languages, valueType: "list", sensitivity: "normal" },
  "documents.resume": { labels: labels["documents.resume"], valueType: "file", sensitivity: "normal", sectionTypes: ["documents"] },
  "documents.coverLetter": { labels: labels["documents.coverLetter"], valueType: "file", sensitivity: "normal", sectionTypes: ["documents"] },
  "applicationDefaults.remotePreference": {
    labels: labels["applicationDefaults.remotePreference"],
    valueType: "option",
    sensitivity: "normal",
    sectionTypes: ["screening"]
  },
  "applicationDefaults.willingToRelocate": {
    labels: labels["applicationDefaults.willingToRelocate"],
    valueType: "boolean",
    sensitivity: "normal",
    sectionTypes: ["screening"]
  },
  "applicationDefaults.sponsorshipRequiredDefault": {
    labels: labels["applicationDefaults.sponsorshipRequiredDefault"],
    negativeLabels: ["company sponsorship", "event sponsorship"],
    valueType: "boolean",
    sensitivity: "sensitive",
    sectionTypes: ["screening"]
  }
};

export const fieldSynonyms: Record<CanonicalFieldKey, string[]> = Object.fromEntries(
  Object.entries(canonicalFieldOntology).map(([key, definition]) => [key, definition.labels])
) as Record<CanonicalFieldKey, string[]>;

export function isSensitiveField(key: CanonicalFieldKey): boolean {
  return canonicalFieldOntology[key].sensitivity === "sensitive";
}
