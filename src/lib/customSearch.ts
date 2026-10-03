import type { CustomSearchRule } from "../types";
import { mergeRules, randomRuleId, reconcileRuleIds } from "./ruleIds";

/** A fresh, practically unique id for a custom search rule (`cs-` and 8 random hex digits). */
export function newCustomSearchId(): string {
  return randomRuleId("cs");
}

export function newCustomSearchRule(): CustomSearchRule {
  return { id: newCustomSearchId(), name: "", pattern: "", isRegex: false, scope: "html" };
}

/** The rules worth sending to the crawler: those with a non-blank pattern. */
export function activeCustomSearches(rules: readonly CustomSearchRule[]): CustomSearchRule[] {
  return rules.filter((r) => r.pattern.trim() !== "");
}

/** Whether two rules count the same thing (the name is only a label). */
function sameDefinition(a: CustomSearchRule, b: CustomSearchRule): boolean {
  return a.pattern === b.pattern && a.isRegex === b.isRegex && a.scope === b.scope;
}

/**
 * Before continuing a stopped crawl: a rule whose id the earlier part of the crawl already
 * used with a different pattern, regex flag or scope gets a fresh id, so one id never stands
 * for two different searches across the pages of one crawl. `renamed` maps old ids to new.
 */
export function reconcileCustomSearchIds(
  rules: readonly CustomSearchRule[],
  previous: readonly CustomSearchRule[],
  makeId: () => string = newCustomSearchId,
): { rules: CustomSearchRule[]; renamed: Map<string, string> } {
  return reconcileRuleIds(rules, previous, sameDefinition, makeId);
}

/** Every rule a continued crawl's pages may have counts for: the earlier rules (updated where
 * `next` has the same id, e.g. a new name) followed by rules new in `next`. */
export function mergeCustomSearchRules(
  previous: readonly CustomSearchRule[],
  next: readonly CustomSearchRule[],
): CustomSearchRule[] {
  return mergeRules(previous, next);
}
