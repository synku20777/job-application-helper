import {
  acceptedCandidateIdsForMode,
  buildFillPlanDiagnostics,
  buildFillPlanFromMatches,
  detectPageActions,
  isSensitiveField,
  matchFields,
  matchFieldsWithLocalOverrides,
  matchFieldsWithOverrides,
  matchFieldsWithSiteRecipes,
  recipeActionsForPageActions
} from "@job-helper/autofill-core";
import { executeFillPlan, scanFormFields } from "@job-helper/dom-utils";
import type { CandidateProfile } from "@job-helper/profile-schema";
import type {
  FieldCandidate,
  FieldMatch,
  ExecutionMode,
  FillOptions,
  FillPlan,
  FillResult,
  FillStep,
  InspectionResult,
  MatchEvidence,
  PageAction,
  PlatformDetection,
  SerializableFieldCandidate
} from "@job-helper/shared";
import type { AdapterRuntimeContext, AtsAdapter, FillExecutionContext, SemanticFieldBoost } from "./baseAdapter";

function runtimeContext(url = "about:blank", document?: Document): AdapterRuntimeContext {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    hostname = "";
  }
  return { document, url, hostname };
}

function directText(node: SerializableFieldCandidate): string {
  return [node.id, node.dom.name, node.dom.id, node.dom.placeholder, node.accessibility.ariaLabel, node.accessibility.ariaLabelledBy, node.accessibility.label]
    .filter(Boolean)
    .join(" ");
}

function contextText(node: SerializableFieldCandidate): string {
  return [
    node.context.sectionTitle,
    node.context.formTitle,
    node.context.pageTitle,
    ...node.context.previousText,
    ...node.context.nextText,
    ...node.context.nearbyText,
    ...(node.context.buttonTextsNearby ?? [])
  ]
    .filter(Boolean)
    .join(" ");
}

function boostApplies(node: SerializableFieldCandidate, boost: SemanticFieldBoost): boolean {
  if (!boost.patterns.some((pattern) => pattern.test(directText(node)))) return false;
  return !boost.contextPatterns?.length || boost.contextPatterns.some((pattern) => pattern.test(contextText(node)));
}

function boostMatch(adapter: AtsAdapter, node: SerializableFieldCandidate, boost: SemanticFieldBoost): FieldMatch {
  const evidence: MatchEvidence = {
    type: "exactAdapterSelector",
    text: node.dom.name ?? node.id ?? node.accessibility.label ?? boost.key,
    weight: 1
  };

  return {
    candidateId: node.id,
    canonicalKey: boost.key,
    confidence: 1,
    evidence: [evidence],
    adapterId: adapter.id,
    fillable: node.geometry.visible && !node.state.disabled,
    requiresReview: Boolean(boost.requiresReview) || boost.key.startsWith("documents.") || isSensitiveField(boost.key),
    node
  };
}

function manualTarget(node: SerializableFieldCandidate, fallbackLabel: string) {
  return {
    candidateId: node.id,
    selector: node.dom.selector ?? "",
    label: node.accessibility.label ?? node.accessibility.ariaLabel ?? node.accessibility.ariaLabelledBy ?? node.dom.placeholder ?? node.dom.name ?? fallbackLabel
  };
}

export async function scanWithAdapter(adapter: AtsAdapter, context: { document: Document; url?: string; hostname?: string }): Promise<FieldCandidate[]> {
  const runtime = runtimeContext(context.url, context.document);
  if (context.hostname) runtime.hostname = context.hostname;
  await adapter.preScan?.(runtime);
  const fields = scanFormFields(context.document);
  return adapter.postProcessCandidates?.(fields, runtime) ?? fields;
}

export async function buildFillPlanWithAdapter(
  adapter: AtsAdapter,
  fields: SerializableFieldCandidate[],
  profile: CandidateProfile,
  options: FillOptions,
  url: string,
  platform?: PlatformDetection
): Promise<FillPlan> {
  return (await buildInspectionWithAdapter(adapter, fields, profile, options, url, "conservative", platform)).plan;
}

export async function buildInspectionWithAdapter(
  adapter: AtsAdapter,
  fields: SerializableFieldCandidate[],
  profile: CandidateProfile,
  options: FillOptions,
  url: string,
  executionMode: ExecutionMode,
  platform?: PlatformDetection,
  pageActions: PageAction[] = []
): Promise<InspectionResult> {
  const runtime = runtimeContext(url);
  const hints = adapter.getSemanticHints?.();
  const localOverrideResult = matchFieldsWithLocalOverrides(fields, adapter.id, options.localMappingOverrides);
  const legacyOverrideResult = matchFieldsWithOverrides(localOverrideResult.remainingFields, adapter.id, options.siteOverride);
  const recipeResult = matchFieldsWithSiteRecipes(legacyOverrideResult.remainingFields, adapter.id, options.siteRecipes);
  const overrideMatches = [...localOverrideResult.overrideMatches, ...legacyOverrideResult.overrideMatches];
  const remainingFields = recipeResult.remainingFields;

  const manualSteps: FillStep[] = [];
  const boostableFields: SerializableFieldCandidate[] = [];

  for (const field of remainingFields) {
    const manual = hints?.manualField?.(field);
    if (manual) {
      manualSteps.push({
        type: "manual",
        target: manualTarget(field, manual.label ?? `${adapter.label} field`),
        canonicalKey: manual.canonicalKey,
        reason: manual.reason,
        requiresReview: true
      });
    } else {
      boostableFields.push(field);
    }
  }

  const boostMatches = boostableFields
    .map((field) => {
      const boost = hints?.fieldBoosts?.find((candidate) => boostApplies(field, candidate));
      return boost ? boostMatch(adapter, field, boost) : undefined;
    })
    .filter((match): match is FieldMatch => Boolean(match));

  const boostIds = new Set(boostMatches.map((match) => match.candidateId));
  const semanticFields = boostableFields.filter((field) => !boostIds.has(field.id));

  const locales = Array.from(new Set([profile.meta.locale, ...(hints?.locales ?? [])].filter((locale): locale is string => Boolean(locale))));
  const semanticMatches = matchFields(semanticFields, adapter.id, { locales });
  const matches = [...overrideMatches, ...recipeResult.recipeMatches, ...boostMatches, ...semanticMatches];
  const detectedPlatform = platform ?? { adapterId: adapter.id, label: adapter.label, confidence: 1 };
  const plan = buildFillPlanFromMatches(
    matches,
    profile,
    detectedPlatform,
    url,
    manualSteps
  );
  const patchedPlan = adapter.postProcessFillPlan?.(plan, runtime) ?? plan;

  const detectedActions = pageActions.length > 0 ? pageActions : runtime.document ? detectPageActions(runtime.document) : [];
  const recipeActionResult = recipeActionsForPageActions(detectedActions, options.siteRecipes);
  const diagnostics = buildFillPlanDiagnostics(fields, matches, patchedPlan, adapter.id);
  diagnostics.pageActions = recipeActionResult.actions;
  diagnostics.appliedOverrideIds = [
    ...localOverrideResult.appliedOverrideIds,
    ...legacyOverrideResult.overrideMatches.map((match) => `legacy:${match.candidateId}`)
  ];
  diagnostics.appliedRecipeIds = Array.from(new Set([...recipeResult.appliedRecipeIds, ...recipeActionResult.appliedRecipeIds]));

  return {
    url,
    platform: detectedPlatform,
    fields,
    matches,
    plan: patchedPlan,
    diagnostics,
    executionMode,
    acceptedCandidateIds: acceptedCandidateIdsForMode(patchedPlan, executionMode),
    options
  };
}

export async function executeWithAdapter(
  adapter: AtsAdapter,
  plan: FillPlan,
  context: FillExecutionContext,
  acceptedElementIds: string[]
): Promise<FillResult> {
  const runtime = runtimeContext(plan.url, context.document);
  await adapter.beforeExecute?.(plan, runtime);
  const result = await executeFillPlan(plan, acceptedElementIds);
  await adapter.afterExecute?.(result, runtime);
  return result;
}
