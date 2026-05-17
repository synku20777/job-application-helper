import type { CandidateProfile } from "../candidateProfile.schema";

export const sampleProfile: CandidateProfile = {
  schemaVersion: "1.0.0",
  meta: {
    profileId: "default",
    label: "Default Profile",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    locale: "en-US",
    defaultCountry: "LV"
  },
  personal: {
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@example.com",
    phone: "+371 20000000",
    address: {
      line1: "Example Street 1",
      city: "Riga",
      region: "Riga",
      postalCode: "LV-1000",
      country: "Latvia"
    },
    links: {
      linkedin: "https://www.linkedin.com/in/example",
      github: "https://github.com/example",
      portfolio: "https://example.com"
    }
  },
  demographics: {
    gender: {
      value: "prefer_not_to_say",
      label: "Prefer not to say"
    }
  },
  workExperience: [
    {
      id: "exp_001",
      company: "Example Company",
      title: "Software Engineer",
      location: "Riga, Latvia",
      startDate: "2022-01",
      endDate: null,
      current: true,
      description: "Built internal automation tooling and web applications.",
      employmentType: "full_time"
    }
  ],
  education: [
    {
      id: "edu_001",
      institution: "University of Latvia",
      degree: "Bachelor's degree",
      fieldOfStudy: "Computer Science",
      startDate: "2018",
      endDate: "2022"
    }
  ],
  skills: [
    { name: "TypeScript", level: "advanced", years: 3 },
    { name: "React", level: "advanced", years: 3 },
    { name: "Python", level: "intermediate", years: 2 }
  ],
  applicationDefaults: {
    remotePreference: "hybrid",
    willingToRelocate: false,
    sponsorshipRequiredDefault: false
  }
};
