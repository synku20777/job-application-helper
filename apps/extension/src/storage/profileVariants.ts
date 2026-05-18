import type { CandidateProfile } from "@job-helper/profile-schema";
import type { ProfileVariant, ProfileVariantOverrides } from "@job-helper/shared";

const allowedOverrideKeys = new Set([
  "links",
  "skills",
  "workExperienceDescription",
  "remotePreference",
  "willingToRelocate",
  "noticePeriod",
  "resumeDocumentId",
  "coverLetterDocumentId"
]);

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  const text = value.trim();
  return text ? text : undefined;
}

export function validateVariantOverrides(value: unknown): ProfileVariantOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Variant overrides must be a JSON object.");
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!allowedOverrideKeys.has(key)) throw new Error(`${key} is not allowed in role variants.`);
  }

  const overrides: ProfileVariantOverrides = {};

  if (input.links !== undefined) {
    if (!input.links || typeof input.links !== "object" || Array.isArray(input.links)) throw new Error("links must be an object.");
    const links = input.links as Record<string, unknown>;
    const allowedLinkKeys = new Set(["linkedin", "github", "portfolio", "website"]);
    for (const key of Object.keys(links)) {
      if (!allowedLinkKeys.has(key)) throw new Error(`links.${key} is not allowed in role variants.`);
    }
    overrides.links = {
      linkedin: optionalString(links.linkedin, "links.linkedin"),
      github: optionalString(links.github, "links.github"),
      portfolio: optionalString(links.portfolio, "links.portfolio"),
      website: optionalString(links.website, "links.website")
    };
  }

  if (input.skills !== undefined) {
    if (!Array.isArray(input.skills) || input.skills.some((skill) => typeof skill !== "string" || !skill.trim())) {
      throw new Error("skills must be an array of non-empty strings.");
    }
    overrides.skills = input.skills.map((skill) => skill.trim());
  }

  overrides.workExperienceDescription = optionalString(input.workExperienceDescription, "workExperienceDescription");

  if (input.remotePreference !== undefined) {
    if (!["remote", "hybrid", "onsite", "flexible"].includes(String(input.remotePreference))) {
      throw new Error("remotePreference must be remote, hybrid, onsite, or flexible.");
    }
    overrides.remotePreference = input.remotePreference as ProfileVariantOverrides["remotePreference"];
  }

  if (input.willingToRelocate !== undefined) {
    if (typeof input.willingToRelocate !== "boolean") throw new Error("willingToRelocate must be a boolean.");
    overrides.willingToRelocate = input.willingToRelocate;
  }

  overrides.noticePeriod = optionalString(input.noticePeriod, "noticePeriod");
  overrides.resumeDocumentId = optionalString(input.resumeDocumentId, "resumeDocumentId");
  overrides.coverLetterDocumentId = optionalString(input.coverLetterDocumentId, "coverLetterDocumentId");

  return overrides;
}

function upsertDocument(profile: CandidateProfile, type: "resume" | "coverLetter", documentId: string): CandidateProfile["documents"] {
  const documents = [...(profile.documents ?? [])];
  const index = documents.findIndex((document) => document.type === type);
  const fallbackLabel = type === "resume" ? "Resume" : "Cover Letter";
  if (index >= 0) {
    documents[index] = { ...documents[index], id: documentId };
  } else {
    documents.push({ id: documentId, type, label: fallbackLabel });
  }
  return documents;
}

export function applyProfileVariant(profile: CandidateProfile, variant: ProfileVariant | null | undefined): CandidateProfile {
  if (!variant) return profile;
  const overrides = variant.overrides;
  let next: CandidateProfile = {
    ...profile,
    personal: {
      ...profile.personal,
      links: overrides.links ? { ...(profile.personal.links ?? {}), ...overrides.links } : profile.personal.links
    },
    applicationDefaults: {
      ...profile.applicationDefaults,
      ...(overrides.remotePreference ? { remotePreference: overrides.remotePreference } : {}),
      ...(overrides.willingToRelocate !== undefined ? { willingToRelocate: overrides.willingToRelocate } : {}),
      ...(overrides.noticePeriod ? { noticePeriod: overrides.noticePeriod } : {})
    }
  };

  if (overrides.skills) next = { ...next, skills: overrides.skills.map((name) => ({ name })) };
  if (overrides.workExperienceDescription && next.workExperience[0]) {
    next = {
      ...next,
      workExperience: [{ ...next.workExperience[0], description: overrides.workExperienceDescription }, ...next.workExperience.slice(1)]
    };
  }
  if (overrides.resumeDocumentId) next = { ...next, documents: upsertDocument(next, "resume", overrides.resumeDocumentId) };
  if (overrides.coverLetterDocumentId) next = { ...next, documents: upsertDocument(next, "coverLetter", overrides.coverLetterDocumentId) };

  return next;
}
