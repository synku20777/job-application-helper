import type { CandidateProfile } from "@job-helper/profile-schema";
import type { FillOptions, FillPlan, FillResult, FieldCandidate, SerializableFieldCandidate, PlatformDetection } from "@job-helper/shared";

export type AdapterDetectContext = {
  url: string;
  hostname: string;
};

export type AdapterScanContext = {
  document: Document;
};

export type FillExecutionContext = {
  document: Document;
};

export interface AtsAdapter {
  id: string;
  label: string;
  priority: number;
  copyOnly?: boolean;
  detect(context: AdapterDetectContext): Promise<PlatformDetection>;
  scan(context: AdapterScanContext): Promise<FieldCandidate[]>;
  buildFillPlan(fields: SerializableFieldCandidate[], profile: CandidateProfile, options: FillOptions, url: string): Promise<FillPlan>;
  executeFillPlan(plan: FillPlan, context: FillExecutionContext, acceptedElementIds: string[]): Promise<FillResult>;
}
