import type { CandidateProfile } from "@job-helper/profile-schema";

export type CandidateDocument = NonNullable<CandidateProfile["documents"]>[number];

export function documentDisplayName(document: CandidateDocument): string {
  return [document.label, document.fileName ? `(${document.fileName})` : ""].filter(Boolean).join(" ");
}

export function describeDocumentReference(profile: CandidateProfile | null | undefined, documentId: string): string {
  const document = profile?.documents?.find((candidate) => candidate.id === documentId);
  return document ? `${documentDisplayName(document)} - ${document.id}` : documentId;
}

export function documentsByType(profile: CandidateProfile | null | undefined, type: CandidateDocument["type"]): CandidateDocument[] {
  return profile?.documents?.filter((document) => document.type === type) ?? [];
}

export function upsertProfileDocument(profile: CandidateProfile, document: CandidateDocument): CandidateProfile {
  const now = new Date().toISOString();
  const documents = [...(profile.documents ?? [])];
  const nextDocument = { ...document, updatedAt: now };
  const existingIndex = documents.findIndex((candidate) => candidate.id === document.id);
  if (existingIndex >= 0) documents[existingIndex] = nextDocument;
  else documents.push(nextDocument);

  return {
    ...profile,
    meta: { ...profile.meta, updatedAt: now },
    documents
  };
}

export function deleteProfileDocument(profile: CandidateProfile, documentId: string): CandidateProfile {
  const now = new Date().toISOString();
  return {
    ...profile,
    meta: { ...profile.meta, updatedAt: now },
    documents: (profile.documents ?? []).filter((document) => document.id !== documentId)
  };
}
