import type { CandidateProfile } from "@job-helper/profile-schema";
import type { CanonicalFieldKey } from "@job-helper/shared";

function first<T>(values: T[] | undefined): T | undefined {
  return values?.[0];
}

export function resolveProfileValue(profile: CandidateProfile, key: CanonicalFieldKey): string | boolean | undefined {
  const firstExperience = first(profile.workExperience);
  const firstEducation = first(profile.education);

  switch (key) {
    case "personal.firstName":
      return profile.personal.firstName;
    case "personal.middleName":
      return profile.personal.middleName;
    case "personal.lastName":
      return profile.personal.lastName;
    case "personal.email":
      return profile.personal.email;
    case "personal.phone":
      return profile.personal.phone;
    case "personal.address.line1":
      return profile.personal.address?.line1;
    case "personal.address.city":
      return profile.personal.address?.city;
    case "personal.address.region":
      return profile.personal.address?.region;
    case "personal.address.postalCode":
      return profile.personal.address?.postalCode;
    case "personal.address.country":
      return profile.personal.address?.country;
    case "personal.links.linkedin":
      return profile.personal.links?.linkedin;
    case "personal.links.github":
      return profile.personal.links?.github;
    case "personal.links.portfolio":
      return profile.personal.links?.portfolio ?? profile.personal.links?.website;
    case "demographics.gender":
      return profile.demographics?.gender?.label;
    case "demographics.pronouns":
      return profile.demographics?.pronouns;
    case "workExperience.company":
      return firstExperience?.company;
    case "workExperience.title":
      return firstExperience?.title;
    case "workExperience.location":
      return firstExperience?.location;
    case "workExperience.startDate":
      return firstExperience?.startDate;
    case "workExperience.endDate":
      return firstExperience?.current ? undefined : firstExperience?.endDate ?? undefined;
    case "workExperience.current":
      return firstExperience?.current;
    case "workExperience.description":
      return firstExperience?.description;
    case "education.institution":
      return firstEducation?.institution;
    case "education.degree":
      return firstEducation?.degree;
    case "education.fieldOfStudy":
      return firstEducation?.fieldOfStudy;
    case "education.startDate":
      return firstEducation?.startDate;
    case "education.endDate":
      return firstEducation?.endDate;
    case "skills":
      return profile.skills.map((skill) => skill.name).join(", ");
    case "languages":
      return profile.languages?.map((language) => language.name).join(", ");
    case "applicationDefaults.remotePreference":
      return profile.applicationDefaults.remotePreference;
    case "applicationDefaults.willingToRelocate":
      return profile.applicationDefaults.willingToRelocate;
    case "applicationDefaults.sponsorshipRequiredDefault":
      return profile.applicationDefaults.sponsorshipRequiredDefault;
    case "documents.resume":
    case "documents.coverLetter":
      return profile.documents?.find((document) => document.type === (key === "documents.resume" ? "resume" : "coverLetter"))?.id;
    default:
      return undefined;
  }
}
