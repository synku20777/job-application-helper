import type { CandidateProfile } from "@job-helper/profile-schema";
import type {
  CanonicalFieldKey,
  FillOptions,
  FillPlan,
  FillResult,
  FieldCandidate,
  SerializableFieldCandidate,
  PlatformDetection
} from "@job-helper/shared";

export type AdapterDetectContext = {
  url: string;
  hostname: string;
};

export type AdapterScanContext = {
  document: Document;
  url?: string;
  hostname?: string;
};

export type FillExecutionContext = {
  document: Document;
};

export type AdapterRuntimeContext = {
  document?: Document;
  url: string;
  hostname: string;
};

export type ParserHints = {
  dynamicPage?: boolean;
  waitForMutations?: boolean;
  scanShadowDom?: boolean;
  usesCustomComboboxes?: boolean;
  hasMultiStepFlow?: boolean;
  mutationWaitMs?: number;
};

export type DriverHints = {
  preferredComboboxDriver?: "ariaComboboxDriver" | "nativeSelectDriver";
  requiresReactInputSetter?: boolean;
};

export type SemanticFieldBoost = {
  key: CanonicalFieldKey;
  patterns: RegExp[];
  contextPatterns?: RegExp[];
  requiresReview?: boolean;
};

export type ManualFieldHint = {
  reason: string;
  label?: string;
  canonicalKey?: CanonicalFieldKey;
};

export type SemanticHints = {
  fieldBoosts?: SemanticFieldBoost[];
  locales?: string[];
  manualField?: (field: SerializableFieldCandidate) => ManualFieldHint | undefined;
};

export interface AtsAdapter {
  id: string;
  label: string;
  priority: number;
  copyOnly?: boolean;
  detect(context: AdapterDetectContext): Promise<PlatformDetection>;
  getParserHints?(): ParserHints;
  getSemanticHints?(): SemanticHints;
  getDriverHints?(): DriverHints;
  preScan?(context: AdapterRuntimeContext): Promise<void>;
  postProcessCandidates?(candidates: FieldCandidate[], context: AdapterRuntimeContext): FieldCandidate[];
  postProcessFillPlan?(plan: FillPlan, context: AdapterRuntimeContext): FillPlan;
  beforeExecute?(plan: FillPlan, context: AdapterRuntimeContext): Promise<void>;
  afterExecute?(result: FillResult, context: AdapterRuntimeContext): Promise<void>;
  scan(context: AdapterScanContext): Promise<FieldCandidate[]>;
  buildFillPlan(fields: SerializableFieldCandidate[], profile: CandidateProfile, options: FillOptions, url: string): Promise<FillPlan>;
  executeFillPlan(plan: FillPlan, context: FillExecutionContext, acceptedElementIds: string[]): Promise<FillResult>;
}
