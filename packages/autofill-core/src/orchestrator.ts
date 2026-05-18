import type { CandidateProfile } from "@job-helper/profile-schema";
import type {
  ExecutionMode,
  FieldMatch,
  FillOptions,
  FillPlan,
  FillPlanDiagnostics,
  FillResult,
  InspectionResult,
  ParserDiagnostics,
  PlatformDetection,
  SerializableFieldCandidate,
  StepDiagnostic
} from "@job-helper/shared";
import { confidencePolicy } from "./confidence";

export type OrchestratorAdapter = {
  id: string;
  label: string;
  getParserHints?: () => unknown;
  getSemanticHints?: () => unknown;
  postProcessCandidates?: (candidates: SerializableFieldCandidate[], context: unknown) => SerializableFieldCandidate[];
  postProcessFillPlan?: (plan: FillPlan, context: unknown) => FillPlan;
};

export type OrchestratorScanner = {
  scan(document: Document, options?: { parserHints?: unknown }): Promise<SerializableFieldCandidate[]>;
};

export type OrchestratorClassifier = {
  classify(candidates: SerializableFieldCandidate[], options?: { semanticHints?: unknown }): FieldMatch[];
};

export type OrchestratorFillPlanBuilder = {
  build(input: {
    profile: CandidateProfile;
    adapter: OrchestratorAdapter;
    candidates: SerializableFieldCandidate[];
    matches: FieldMatch[];
    options?: FillOptions;
    url: string;
    platform: PlatformDetection;
  }): FillPlan;
};

export type OrchestratorExecutor = {
  execute(plan: FillPlan, acceptedCandidateIds: string[]): Promise<FillResult>;
};

function stepStatus(step: FillPlan["steps"][number]): StepDiagnostic["status"] {
  if (step.type === "uploadFile") return "upload";
  if (step.type === "manual") return "manual";
  if (step.requiresReview) return "review";
  return "auto";
}

function driverForStep(step: FillPlan["steps"][number]): StepDiagnostic["driver"] {
  if (step.type === "setText") return "nativeText";
  if (step.type === "selectOption") return "nativeSelect";
  if (step.type === "clickCheckbox") return "checkbox";
  if (step.type === "uploadFile") return "upload";
  return "manual";
}

function candidateLabel(candidate: SerializableFieldCandidate): string {
  return candidate.accessibility.label ?? candidate.accessibility.ariaLabel ?? candidate.dom.placeholder ?? candidate.dom.name ?? candidate.dom.tagName;
}

export function acceptedCandidateIdsForMode(plan: FillPlan, mode: ExecutionMode): string[] {
  if (mode !== "conservative") return [];
  return plan.steps
    .filter((step) => step.type !== "manual" && step.type !== "uploadFile" && !step.requiresReview)
    .filter((step) => !("confidence" in step) || step.confidence >= confidencePolicy.autoFill)
    .map((step) => step.target.candidateId);
}

export function buildFillPlanDiagnostics(
  fields: SerializableFieldCandidate[],
  matches: FieldMatch[],
  plan: FillPlan,
  adapterId: string
): FillPlanDiagnostics {
  const matchedIds = new Set(matches.map((match) => match.candidateId));
  const plannedIds = new Set(plan.steps.map((step) => step.target.candidateId));
  const sections = new Set(fields.flatMap((field) => [field.context.sectionTitle, field.context.sectionType]).filter(Boolean));
  const repeatableGroups = new Set(fields.map((field) => field.context.repeatableGroup?.id).filter(Boolean));

  const parser: ParserDiagnostics = {
    scannedElements: fields.length,
    candidateFields: fields.length,
    sectionsDetected: sections.size,
    repeatableGroupsDetected: repeatableGroups.size,
    ignoredHiddenElements: 0,
    highConfidenceMatches: matches.filter((match) => match.confidence >= confidencePolicy.autoFill && !match.requiresReview).length,
    reviewRequiredMatches: matches.filter((match) => match.requiresReview || match.confidence < confidencePolicy.autoFill).length,
    manualSteps: plan.steps.filter((step) => step.type === "manual" || step.type === "uploadFile").length,
    skippedFields: fields.filter((field) => !matchedIds.has(field.id) && !plannedIds.has(field.id)).length,
    adapterId,
    parserVersion: "phase-6",
    warnings: plan.warnings.map((warning) => warning.message)
  };

  const steps = plan.steps.map<StepDiagnostic>((step) => {
    const match = matches.find((candidate) => candidate.candidateId === step.target.candidateId);
    const field = fields.find((candidate) => candidate.id === step.target.candidateId);
    return {
      candidateId: step.target.candidateId,
      label: step.target.label || (field ? candidateLabel(field) : step.target.candidateId),
      canonicalKey: "canonicalKey" in step ? step.canonicalKey : match?.canonicalKey,
      confidence: "confidence" in step ? step.confidence : match?.confidence,
      status: stepStatus(step),
      action: step.type,
      evidence: match?.evidence ?? [],
      sectionType: field?.context.sectionType,
      sectionTitle: field?.context.sectionTitle,
      repeatableGroup: field?.context.repeatableGroup,
      driver: driverForStep(step)
    };
  });

  return { parser, steps };
}

export class AutofillOrchestrator {
  constructor(
    private readonly scanner: OrchestratorScanner,
    private readonly classifier: OrchestratorClassifier,
    private readonly fillPlanBuilder: OrchestratorFillPlanBuilder,
    private readonly executor: OrchestratorExecutor
  ) {}

  async inspectPage(input: {
    document: Document;
    profile: CandidateProfile;
    adapter: OrchestratorAdapter;
    platform: PlatformDetection;
    url: string;
    executionMode: ExecutionMode;
    options?: FillOptions;
  }): Promise<InspectionResult> {
    const candidates = await this.scanner.scan(input.document, { parserHints: input.adapter.getParserHints?.() });
    const patchedCandidates = input.adapter.postProcessCandidates?.(candidates, { document: input.document, url: input.url }) ?? candidates;
    const matches = this.classifier.classify(patchedCandidates, { semanticHints: input.adapter.getSemanticHints?.() });
    const fillPlan = this.fillPlanBuilder.build({
      profile: input.profile,
      adapter: input.adapter,
      candidates: patchedCandidates,
      matches,
      options: input.options,
      url: input.url,
      platform: input.platform
    });
    const patchedPlan = input.adapter.postProcessFillPlan?.(fillPlan, { document: input.document, url: input.url }) ?? fillPlan;

    return {
      url: input.url,
      platform: input.platform,
      fields: patchedCandidates,
      matches,
      plan: patchedPlan,
      diagnostics: buildFillPlanDiagnostics(patchedCandidates, matches, patchedPlan, input.adapter.id),
      executionMode: input.executionMode,
      acceptedCandidateIds: acceptedCandidateIdsForMode(patchedPlan, input.executionMode),
      options: input.options
    };
  }

  async executePlan(plan: FillPlan, acceptedCandidateIds: string[]): Promise<FillResult> {
    return this.executor.execute(plan, acceptedCandidateIds);
  }
}
