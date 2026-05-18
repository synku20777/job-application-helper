import type { CanonicalFieldKey } from "@job-helper/shared";

export type LabelDictionaryLocale = "en" | "de";

export type LabelDictionary = Partial<Record<CanonicalFieldKey, string[]>>;

export const labelDictionaries: Record<LabelDictionaryLocale, LabelDictionary> = {
  en: {
    "personal.firstName": ["first name", "given name", "forename", "legal first name"],
    "personal.middleName": ["middle name"],
    "personal.lastName": ["last name", "surname", "family name", "legal last name"],
    "personal.email": ["email", "email address", "e-mail"],
    "personal.phone": ["phone", "phone number", "mobile", "telephone", "contact number"],
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
    "documents.resume": ["resume", "cv", "curriculum vitae"],
    "documents.coverLetter": ["cover letter", "motivation letter"],
    "applicationDefaults.remotePreference": ["remote preference", "workplace preference"],
    "applicationDefaults.willingToRelocate": ["willing to relocate", "relocate"],
    "applicationDefaults.sponsorshipRequiredDefault": ["sponsorship", "visa sponsorship", "work authorization"]
  },
  de: {
    "personal.firstName": ["vorname", "rufname"],
    "personal.lastName": ["nachname", "familienname"],
    "personal.email": ["email", "e-mail", "e mail adresse"],
    "personal.phone": ["telefon", "telefonnummer", "mobilnummer", "handynummer"],
    "personal.address.line1": ["adresse", "anschrift", "strasse", "straße", "strasse und hausnummer", "straße und hausnummer"],
    "personal.address.city": ["stadt", "ort", "wohnort"],
    "personal.address.region": ["bundesland", "region"],
    "personal.address.postalCode": ["postleitzahl", "plz"],
    "personal.address.country": ["land"],
    "personal.links.linkedin": ["linkedin", "linkedin profil"],
    "personal.links.github": ["github", "github profil"],
    "personal.links.portfolio": ["portfolio", "webseite", "website", "homepage"],
    "demographics.gender": ["geschlecht"],
    "workExperience.company": ["unternehmen", "arbeitgeber", "firma"],
    "workExperience.title": ["position", "berufsbezeichnung", "jobtitel", "taetigkeit", "tätigkeit"],
    "workExperience.location": ["arbeitsort", "standort"],
    "workExperience.startDate": ["startdatum", "beginn", "von"],
    "workExperience.endDate": ["enddatum", "ende", "bis"],
    "workExperience.current": ["aktuelle position", "derzeit", "heute"],
    "workExperience.description": ["berufserfahrung", "beschreibung", "aufgaben", "erfolge"],
    "education.institution": ["ausbildung", "schule", "universitaet", "universität", "hochschule", "institution"],
    "education.degree": ["abschluss", "qualifikation"],
    "education.fieldOfStudy": ["studienfach", "fachrichtung", "studiengang"],
    "education.startDate": ["ausbildung startdatum", "studium beginn", "von"],
    "education.endDate": ["ausbildung enddatum", "abschlussdatum", "bis"],
    skills: ["kenntnisse", "faehigkeiten", "fähigkeiten", "kompetenzen", "technische kenntnisse"],
    languages: ["sprachen", "sprachkenntnisse"],
    "documents.resume": ["lebenslauf", "cv"],
    "documents.coverLetter": ["anschreiben", "motivationsschreiben"],
    "applicationDefaults.remotePreference": ["remote praferenz", "remote präferenz", "arbeitsplatz praferenz", "arbeitsplatz präferenz"],
    "applicationDefaults.willingToRelocate": ["umzugsbereitschaft", "bereit umzuziehen"],
    "applicationDefaults.sponsorshipRequiredDefault": ["visum sponsoren", "arbeitserlaubnis", "arbeitsgenehmigung"]
  }
};

const defaultLocales: LabelDictionaryLocale[] = ["en", "de"];

export function normalizeDictionaryLocale(locale: string | undefined): LabelDictionaryLocale | undefined {
  const language = locale?.toLowerCase().split(/[-_]/)[0];
  return language === "en" || language === "de" ? language : undefined;
}

export function resolveEffectiveSynonyms(locales: Array<string | undefined> = []): Record<CanonicalFieldKey, string[]> {
  const requestedLocales = locales.map(normalizeDictionaryLocale).filter((locale): locale is LabelDictionaryLocale => Boolean(locale));
  const effectiveLocales = Array.from(new Set([...requestedLocales, ...defaultLocales]));
  const synonyms = {} as Record<CanonicalFieldKey, string[]>;

  for (const locale of effectiveLocales) {
    for (const [key, values] of Object.entries(labelDictionaries[locale]) as Array<[CanonicalFieldKey, string[] | undefined]>) {
      synonyms[key] = Array.from(new Set([...(synonyms[key] ?? []), ...(values ?? [])]));
    }
  }

  return synonyms;
}
