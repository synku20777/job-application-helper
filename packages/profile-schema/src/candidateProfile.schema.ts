import { z } from "zod";

const optionalString = z.string().trim().optional();
const dateLike = z.string().trim().min(1);

export const addressSchema = z.object({
  line1: z.string().trim().min(1).optional(),
  line2: optionalString,
  city: optionalString,
  region: optionalString,
  postalCode: optionalString,
  country: optionalString
});

export const candidateLinksSchema = z.object({
  linkedin: optionalString,
  github: optionalString,
  portfolio: optionalString,
  website: optionalString
});

export const demographicAnswerSchema = z.object({
  value: z.string().trim().min(1),
  label: z.string().trim().min(1)
});

export const workAuthorizationSchema = z.object({
  country: z.string().trim().min(1),
  authorized: z.boolean(),
  sponsorshipRequired: z.boolean().optional(),
  note: optionalString
});

export const workExperienceSchema = z.object({
  id: z.string().trim().min(1),
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
  location: optionalString,
  startDate: dateLike,
  endDate: z.string().trim().min(1).nullable().optional(),
  current: z.boolean().optional(),
  description: optionalString,
  employmentType: optionalString
});

export const educationSchema = z.object({
  id: z.string().trim().min(1),
  institution: z.string().trim().min(1),
  degree: optionalString,
  fieldOfStudy: optionalString,
  startDate: optionalString,
  endDate: optionalString
});

export const skillSchema = z.object({
  name: z.string().trim().min(1),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  years: z.number().nonnegative().optional()
});

export const languageSkillSchema = z.object({
  name: z.string().trim().min(1),
  proficiency: optionalString
});

export const certificationSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  issuer: optionalString,
  issuedAt: optionalString,
  expiresAt: z.string().trim().min(1).nullable().optional()
});

export const candidateDocumentSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(["resume", "coverLetter", "other"]),
  label: z.string().trim().min(1),
  fileName: optionalString,
  mimeType: optionalString
});

export const compensationExpectationSchema = z.object({
  amount: z.number().nonnegative().optional(),
  currency: optionalString,
  period: z.enum(["hour", "month", "year"]).optional(),
  note: optionalString
});

export const platformProfileOverrideSchema = z.object({
  fieldValues: z.record(z.unknown()).optional(),
  notes: optionalString
});

export const candidateProfileSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  meta: z.object({
    profileId: z.string().trim().min(1),
    label: z.string().trim().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    locale: z.string().trim().min(2),
    defaultCountry: optionalString
  }),
  personal: z.object({
    firstName: z.string().trim().min(1),
    middleName: optionalString,
    lastName: z.string().trim().min(1),
    preferredName: optionalString,
    email: z.string().email(),
    phone: z.string().trim().min(1),
    address: addressSchema.optional(),
    links: candidateLinksSchema.optional()
  }),
  demographics: z
    .object({
      gender: demographicAnswerSchema.optional(),
      pronouns: optionalString,
      veteranStatus: demographicAnswerSchema.optional(),
      disabilityStatus: demographicAnswerSchema.optional(),
      ethnicity: demographicAnswerSchema.optional(),
      workAuthorization: z.array(workAuthorizationSchema).optional()
    })
    .optional(),
  workExperience: z.array(workExperienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  skills: z.array(skillSchema).default([]),
  languages: z.array(languageSkillSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
  documents: z.array(candidateDocumentSchema).optional(),
  applicationDefaults: z.object({
    desiredSalary: compensationExpectationSchema.optional(),
    noticePeriod: optionalString,
    willingToRelocate: z.boolean().optional(),
    remotePreference: z.enum(["remote", "hybrid", "onsite", "flexible"]).optional(),
    legalWorkAuthorizationDefault: optionalString,
    sponsorshipRequiredDefault: z.boolean().optional()
  }),
  customFields: z.record(z.unknown()).optional(),
  platformOverrides: z.record(platformProfileOverrideSchema).optional()
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

export function parseCandidateProfile(value: unknown): CandidateProfile {
  return candidateProfileSchema.parse(value);
}

export function safeParseCandidateProfile(value: unknown) {
  return candidateProfileSchema.safeParse(value);
}
