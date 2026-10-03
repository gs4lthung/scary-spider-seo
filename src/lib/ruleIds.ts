/**
 * Id bookkeeping shared by the per-crawl rule lists (custom search, custom extraction): each
 * rule's results on a page are keyed by the rule's id, so an id must never stand for two
 * different rules across the pages of one crawl.
 */

/**
 * A fresh, practically unique rule id: `prefix`, a dash and 8 random hex digits. Ids are never
 * derived from the rules in the sheet, so removing a rule and adding another can not hand the
 * removed rule's id, whose results may still be on screen, to a different rule.
 */
export function randomRuleId(prefix: string): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Before continuing a stopped crawl: a rule whose id the earlier part of the crawl already used
 * for a different definition (per `sameDefinition`) gets a fresh id from `makeId`. `renamed`
 * maps old ids to new.
 */
export function reconcileRuleIds<T extends { id: string }>(
  rules: readonly T[],
  previous: readonly T[],
  sameDefinition: (a: T, b: T) => boolean,
  makeId: () => string,
): { rules: T[]; renamed: Map<string, string> } {
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

/** Every rule a continued crawl's pages may have results for: the earlier rules (updated where
 * `next` has the same id, e.g. a new name) followed by rules new in `next`. */
export function mergeRules<T extends { id: string }>(previous: readonly T[], next: readonly T[]): T[] {
  const byId = new Map(next.map((r) => [r.id, r]));
  const merged = previous.map((r) => byId.get(r.id) ?? r);
  const known = new Set(previous.map((r) => r.id));
  return [...merged, ...next.filter((r) => !known.has(r.id))];
}
