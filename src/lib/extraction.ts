import type { ExtractionRule, PageResult } from "../types";
import { mergeRules, randomRuleId, reconcileRuleIds } from "./ruleIds";

/** A fresh, practically unique id for a custom extraction rule (`ex-` and 8 random hex digits). */
export function newExtractionId(): string {
  return randomRuleId("ex");
}

export function newExtractionRule(): ExtractionRule {
  return { id: newExtractionId(), name: "", selector: "", mode: "text", attr: null };
}

/**
 * The rules worth sending to the crawler: those with a non-blank selector. The attribute is
 * kept (trimmed) only in attribute mode, so a rule switched away from it is not compared by an
 * attribute it no longer reads.
 */
export function activeExtractions(rules: readonly ExtractionRule[]): ExtractionRule[] {
  return rules
    .filter((r) => r.selector.trim() !== "")
    .map((r) => ({ ...r, attr: r.mode === "attr" ? (r.attr ?? "").trim() : null }));
}

/** Whether two rules extract the same thing (the name is only a label). */
function sameDefinition(a: ExtractionRule, b: ExtractionRule): boolean {
  return a.selector.trim() === b.selector.trim() && a.mode === b.mode && (a.attr ?? "") === (b.attr ?? "");
}

/**
 * Before continuing a stopped crawl: a rule whose id the earlier part of the crawl already used
 * with a different selector, mode or attribute gets a fresh id, so one id never stands for two
 * different extractions across the pages of one crawl. `renamed` maps old ids to new.
 */
export function reconcileExtractionIds(
  rules: readonly ExtractionRule[],
  previous: readonly ExtractionRule[],
  makeId: () => string = newExtractionId,
): { rules: ExtractionRule[]; renamed: Map<string, string> } {
  return reconcileRuleIds(rules, previous, sameDefinition, makeId);
}

/** Every rule a continued crawl's pages may have values for (see `mergeRules`). */
export function mergeExtractionRules(
  previous: readonly ExtractionRule[],
  next: readonly ExtractionRule[],
): ExtractionRule[] {
  return mergeRules(previous, next);
}

/** Adds the extraction rule ids found on `page` to `ids` (O(rules) per page). */
export function ingestExtractionIds(ids: Set<string>, page: PageResult): void {
  for (const id of Object.keys(page.extracted)) ids.add(id);
}

/** One custom extraction rule as a Pages table column. */
export interface ExtractionColumn {
  id: string;
  label: string;
}

/**
 * The extraction columns to show for the results on screen: the rules the crawl ran with
 * (`crawlRules`, in order, even before any page has values; for a loaded crawl, the rules saved
 * in its snapshot), then any other rule id found on the pages, labelled "Extraction <id>". A
 * rule is labelled by its name, else its selector. A label already used gets " (2)", " (3)"...
 * appended, as in the CSV export. Names are never borrowed from the options sheet: a rule there
 * with the same id may extract something else.
 */
export function getExtractionColumns(
  idsOnPages: Iterable<string>,
  crawlRules: readonly ExtractionRule[],
): ExtractionColumn[] {
  const labelled: ExtractionColumn[] = [];
  const seen = new Set<string>();
  const push = (id: string, label: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    labelled.push({ id, label });
  };
  for (const rule of crawlRules) {
    if (rule.selector.trim() !== "") push(rule.id, rule.name.trim() || rule.selector.trim());
  }
  for (const id of idsOnPages) push(id, `Extraction ${id}`);
  const used = new Set<string>();
  return labelled.map(({ id, label }) => {
    let unique = label;
    for (let n = 2; used.has(unique); n++) unique = `${label} (${n})`;
    used.add(unique);
    return { id, label: unique };
  });
}

/** A page's values for one rule as one cell: joined with " | ", or null where the rule never ran. */
export function extractedCell(page: PageResult, id: string): string | null {
  const values = page.extracted[id] as string[] | undefined;
  return values ? values.join(" | ") : null;
}
