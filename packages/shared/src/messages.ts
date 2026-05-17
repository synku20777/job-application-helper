import type { FillOptions, FillPlan, FillResult, FormFieldNode, PlatformDetection, SavedFieldOverride, SiteMappingOverride } from "./types";
import type { CandidateProfile } from "@job-helper/profile-schema";

export type ExtensionMessage =
  | { type: "SCAN_PAGE" }
  | { type: "BUILD_FILL_PLAN"; profile: CandidateProfile; fields: FormFieldNode[]; platform: PlatformDetection }
  | { type: "EXECUTE_FILL_PLAN"; plan: FillPlan; acceptedElementIds: string[] }
  | { type: "GET_SELECTED_PROFILE" }
  | { type: "SAVE_PROFILE"; profile: CandidateProfile }
  | { type: "EXPORT_PROFILE" }
  | { type: "GET_SITE_OVERRIDES"; hostname: string; adapterId: string }
  | { type: "SAVE_SITE_OVERRIDE"; hostname: string; adapterId: string; override: Omit<SavedFieldOverride, "id" | "createdAt" | "updatedAt"> }
  | { type: "DELETE_SITE_OVERRIDE"; hostname: string; adapterId: string; overrideId: string }
  | { type: "DELETE_ALL_DATA" };

export type ExtensionResponse =
  | { ok: true; type: "SCAN_PAGE"; fields: FormFieldNode[]; platform: PlatformDetection; url: string }
  | { ok: true; type: "BUILD_FILL_PLAN"; plan: FillPlan; options?: FillOptions }
  | { ok: true; type: "EXECUTE_FILL_PLAN"; result: FillResult }
  | { ok: true; type: "GET_SELECTED_PROFILE"; profile: CandidateProfile | null }
  | { ok: true; type: "SAVE_PROFILE"; profile: CandidateProfile }
  | { ok: true; type: "EXPORT_PROFILE"; profile: CandidateProfile | null }
  | { ok: true; type: "GET_SITE_OVERRIDES"; override: SiteMappingOverride | null }
  | { ok: true; type: "SAVE_SITE_OVERRIDE"; override: SiteMappingOverride }
  | { ok: true; type: "DELETE_SITE_OVERRIDE"; override: SiteMappingOverride | null }
  | { ok: true; type: "DELETE_ALL_DATA" }
  | { ok: false; error: string };
