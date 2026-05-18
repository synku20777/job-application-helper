import type { CanonicalFieldKey, FieldMatch, PageAction, SiteRecipe, SerializableFieldCandidate } from "@job-helper/shared";
import { isSensitiveField } from "./fieldOntology";

export function hostnameMatchesRecipe(hostname: string, recipe: SiteRecipe): boolean {
  const escaped = recipe.hostnamePattern
    .toLowerCase()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(hostname.toLowerCase());
}

export function validateSiteRecipe(input: unknown): Omit<SiteRecipe, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Recipe must be a JSON object.");
  const recipe = input as Partial<SiteRecipe>;
  if (!recipe.id?.trim()) throw new Error("Recipe id is required.");
  if (!recipe.label?.trim()) throw new Error("Recipe label is required.");
  if (!recipe.hostnamePattern?.trim()) throw new Error("Recipe hostnamePattern is required.");
  if (!recipe.fields || typeof recipe.fields !== "object" || Array.isArray(recipe.fields)) throw new Error("Recipe fields are required.");

  for (const selectors of Object.values(recipe.fields)) {
    if (!Array.isArray(selectors)) throw new Error("Recipe field selectors must be arrays.");
    for (const selector of selectors) {
      if (!selector.selector?.trim()) throw new Error("Recipe field selector is required.");
      if (selector.strategy !== "css") throw new Error("Only CSS recipe selectors are supported.");
      if (/\bscript\b|javascript:/i.test(selector.selector)) throw new Error("Unsafe recipe selector rejected.");
    }
  }

  return recipe as Omit<SiteRecipe, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string };
}

function recipeSelectorMatches(field: SerializableFieldCandidate, selector: string): boolean {
  return Boolean(field.dom.selector && field.dom.selector === selector);
}

export function matchFieldsWithSiteRecipes<T extends SerializableFieldCandidate>(
  fields: T[],
  adapterId: string,
  recipes: SiteRecipe[] = []
): { recipeMatches: FieldMatch[]; remainingFields: T[]; appliedRecipeIds: string[] } {
  const matchedIds = new Set<string>();
  const appliedRecipeIds = new Set<string>();
  const recipeMatches: FieldMatch[] = [];

  for (const field of fields) {
    const match = recipes.flatMap((recipe) =>
      (Object.entries(recipe.fields) as Array<[CanonicalFieldKey, NonNullable<SiteRecipe["fields"][CanonicalFieldKey]>]>).flatMap(
        ([canonicalKey, selectors]) =>
          selectors.map((selector) => ({ recipe, canonicalKey, selector })).filter((candidate) => recipeSelectorMatches(field, candidate.selector.selector))
      )
    )[0];

    if (!match) continue;
    const confidence = match.selector.confidence ?? 0.95;
    matchedIds.add(field.id);
    appliedRecipeIds.add(match.recipe.id);
    recipeMatches.push({
      candidateId: field.id,
      canonicalKey: match.canonicalKey,
      confidence,
      evidence: [{ type: "exactAdapterSelector", text: match.selector.selector, weight: confidence }],
      adapterId,
      fillable: field.geometry.visible && !field.state.disabled,
      requiresReview: confidence < 0.9 || isSensitiveField(match.canonicalKey),
      node: field
    });
  }

  return {
    recipeMatches,
    remainingFields: fields.filter((field) => !matchedIds.has(field.id)),
    appliedRecipeIds: Array.from(appliedRecipeIds)
  };
}

export function recipeActionsForPageActions(actions: PageAction[], recipes: SiteRecipe[] = []): { actions: PageAction[]; appliedRecipeIds: string[] } {
  const recipeActions = recipes.flatMap((recipe) =>
    Object.entries(recipe.actions ?? {}).flatMap(([type, selectors]) =>
      (selectors ?? []).map((selector, index) => ({
        id: `${recipe.id}:${type}:${index}`,
        type: type as PageAction["type"],
        label: selector.label ?? type,
        selector: selector.selector,
        confidence: selector.confidence ?? 0.9,
        recipeId: recipe.id
      }))
    )
  );

  return {
    actions: [...actions, ...recipeActions.map(({ recipeId: _recipeId, ...action }) => action)],
    appliedRecipeIds: Array.from(new Set(recipeActions.map((action) => action.recipeId)))
  };
}
