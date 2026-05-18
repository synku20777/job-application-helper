import type { CandidateProfile } from "@job-helper/profile-schema";

export type ProfileSnippet = {
  id: string;
  label: string;
  value: string;
  description?: string;
};

function compact(value: string | undefined | null): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function addSnippet(snippets: ProfileSnippet[], snippet: ProfileSnippet) {
  if (compact(snippet.value)) snippets.push({ ...snippet, value: snippet.value.trim() });
}

function dateRange(startDate: string | undefined, endDate: string | null | undefined, current: boolean | undefined): string {
  const end = current ? "Present" : compact(endDate) ?? "";
  return [compact(startDate), end].filter(Boolean).join(" - ");
}

export function buildProfileSnippets(profile: CandidateProfile): ProfileSnippet[] {
  const snippets: ProfileSnippet[] = [];
  const name = [profile.personal.firstName, profile.personal.middleName, profile.personal.lastName].map(compact).filter(Boolean).join(" ");
  const address = profile.personal.address;
  const location = [address?.city, address?.region, address?.country].map(compact).filter(Boolean).join(", ");
  const links = profile.personal.links;
  const latestRole = profile.workExperience[0];
  const latestEducation = profile.education[0];

  addSnippet(snippets, { id: "name", label: "Name", value: name });
  addSnippet(snippets, { id: "email", label: "Email", value: profile.personal.email });
  addSnippet(snippets, { id: "phone", label: "Phone", value: profile.personal.phone });
  addSnippet(snippets, { id: "location", label: "Location", value: location });
  addSnippet(snippets, { id: "linkedin", label: "LinkedIn URL", value: links?.linkedin ?? "" });
  addSnippet(snippets, { id: "portfolio", label: "Portfolio", value: links?.portfolio ?? links?.website ?? "" });
  addSnippet(snippets, { id: "github", label: "GitHub", value: links?.github ?? "" });
  addSnippet(snippets, {
    id: "skills",
    label: "Skills",
    value: profile.skills.map((skill) => skill.name).filter(Boolean).join(", ")
  });

  if (latestRole) {
    addSnippet(snippets, {
      id: "latest-role",
      label: "Latest Role",
      value: [latestRole.title, latestRole.company].map(compact).filter(Boolean).join(" at "),
      description: "Current or most recent profile role"
    });
    addSnippet(snippets, {
      id: "work-summary",
      label: "Work Experience Summary",
      value: [
        [latestRole.title, latestRole.company].map(compact).filter(Boolean).join(" at "),
        compact(latestRole.location),
        dateRange(latestRole.startDate, latestRole.endDate, latestRole.current),
        compact(latestRole.description)
      ]
        .filter(Boolean)
        .join("\n")
    });
  }

  if (latestEducation) {
    addSnippet(snippets, {
      id: "education-summary",
      label: "Education Summary",
      value: [
        [latestEducation.degree, latestEducation.fieldOfStudy].map(compact).filter(Boolean).join(", "),
        compact(latestEducation.institution),
        dateRange(latestEducation.startDate, latestEducation.endDate, false)
      ]
        .filter(Boolean)
        .join("\n")
    });
  }

  return snippets;
}
