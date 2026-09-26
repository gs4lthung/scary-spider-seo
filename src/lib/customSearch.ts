import type { CustomSearchRule } from "../types";

const ID_PREFIX = "cs";

/**
 * A fresh id for a new custom search rule: one past the highest `cs<N>` in use, so a removed
 * rule's id is not handed to a different rule while its counts may still be on screen.
 */
export function nextCustomSearchId(rules: readonly CustomSearchRule[]): string {
  let max = 0;
  for (const { id } of rules) {
    const match = /^cs(\d+)$/.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${ID_PREFIX}${max + 1}`;
}

export function newCustomSearchRule(rules: readonly CustomSearchRule[]): CustomSearchRule {
  return { id: nextCustomSearchId(rules), name: "", pattern: "", isRegex: false, scope: "html" };
}

/** The rules worth sending to the crawler: those with a non-blank pattern. */
export function activeCustomSearches(rules: readonly CustomSearchRule[]): CustomSearchRule[] {
  return rules.filter((r) => r.pattern.trim() !== "");
}
