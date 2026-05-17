import type { CanonicalFieldKey } from "@job-helper/shared";

export const fieldSynonyms: Record<CanonicalFieldKey, string[]> = {
  "personal.firstName": ["first name", "given name", "forename", "legal first name", "vorname"],
  "personal.middleName": ["middle name"],
  "personal.lastName": ["last name", "surname", "family name", "legal last name", "nachname"],
  "personal.email": ["email", "email address", "e-mail"],
  "personal.phone": ["phone", "phone number", "mobile", "telephone", "contact number", "telefon", "mobilnummer"],
  "personal.address.line1": ["address", "street address", "address line 1", "street"],
  "personal.address.city": ["city", "town"],
  "personal.address.region": ["state", "province", "region", "county"],
  "personal.address.postalCode": ["postal code", "postcode", "zip", "zip code"],
  "personal.address.country": ["country"],
  "personal.links.linkedin": ["linkedin", "linkedin profile", "linkedin url"],
  "personal.links.github": ["github", "github profile", "github url"],
  "personal.links.portfolio": ["portfolio", "website", "personal website", "homepage"],
  "demographics.gender": ["gender", "sex"],
  "demographics.pronouns": ["pronouns"],
  "workExperience.company": ["company", "employer", "organization", "organisation"],
  "workExperience.title": ["job title", "position", "role", "title"],
  "workExperience.location": ["work location", "job location", "location"],
  "workExperience.startDate": ["start date", "from", "employment start"],
  "workExperience.endDate": ["end date", "to", "employment end"],
  "workExperience.current": ["current role", "currently work here", "present"],
  "workExperience.description": ["description", "responsibilities", "achievements"],
  "education.institution": ["school", "university", "institution", "college"],
  "education.degree": ["degree", "qualification", "education level"],
  "education.fieldOfStudy": ["field of study", "major", "subject"],
  "education.startDate": ["education start date", "school start"],
  "education.endDate": ["education end date", "graduation date", "school end"],
  skills: ["skills", "technologies", "competencies", "technical skills"],
  languages: ["languages", "spoken languages"],
  "documents.resume": ["resume", "cv", "curriculum vitae", "lebenslauf"],
  "documents.coverLetter": ["cover letter", "motivation letter"],
  "applicationDefaults.remotePreference": ["remote preference", "workplace preference"],
  "applicationDefaults.willingToRelocate": ["willing to relocate", "relocate"],
  "applicationDefaults.sponsorshipRequiredDefault": ["sponsorship", "visa sponsorship", "work authorization"]
};

export const sensitiveFields = new Set<CanonicalFieldKey>([
  "demographics.gender",
  "demographics.pronouns",
  "applicationDefaults.sponsorshipRequiredDefault"
]);

export function isSensitiveField(key: CanonicalFieldKey): boolean {
  return sensitiveFields.has(key);
}
