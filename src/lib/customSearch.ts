import type { CustomSearchRule } from "../types";

/**
 * A fresh, practically unique id for a custom search rule (`cs-` and 8 random hex digits).
 * Ids are never derived from the rules in the sheet, so removing a rule and adding another can
 * not hand the removed rule's id, whose counts may still be on screen, to a different rule.
 */
export function newCustomSearchId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `cs-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
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
  const before = new Map(previous.map((r) => [r.id, r]));
  const renamed = new Map<string, string>();
  const next = rules.map((rule) => {
    const earlier = before.get(rule.id);
    if (!earlier || sameDefinition(earlier, rule)) return rule;
    const id = makeId();
    renamed.set(rule.id, id);
    return { ...rule, id };
  });
  return { rules: next, renamed };
}

/** Every rule a continued crawl's pages may have counts for: the earlier rules (updated where
 * `next` has the same id, e.g. a new name) followed by rules new in `next`. */
export function mergeCustomSearchRules(
  previous: readonly CustomSearchRule[],
  next: readonly CustomSearchRule[],
): CustomSearchRule[] {
  const byId = new Map(next.map((r) => [r.id, r]));
  const merged = previous.map((r) => byId.get(r.id) ?? r);
  const known = new Set(previous.map((r) => r.id));
  return [...merged, ...next.filter((r) => !known.has(r.id))];
}
