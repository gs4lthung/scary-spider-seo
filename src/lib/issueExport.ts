import type { PageResult, ResourceResult } from "../types";
import {
  type FilterContext,
  type IssueDef,
  type IssueKey,
  type PageIssueDef,
  type ResourceIssueDef,
  ISSUE_DEFS,
  countIssues,
} from "./filters";

/** UTF-8 byte order mark, so Excel reads the file as UTF-8 instead of the ANSI code page. */
const BOM = "\uFEFF";
const LINE_END = "\r\n";

/** Leading characters a spreadsheet treats as the start of a formula. */
const FORMULA_PREFIX = /^[=+\-@]/;

/** Severity written for an issue: its Overview tone, or `info` for a neutral count. */
export type IssueSeverity = "bad" | "warn" | "info";

const ALL_DEFS: readonly IssueDef<IssueKey>[] = ISSUE_DEFS;
const PAGE_DEFS = ALL_DEFS.filter((d): d is PageIssueDef<IssueKey> => d.scope === "page");
const RESOURCE_DEFS = ALL_DEFS.filter((d): d is ResourceIssueDef<IssueKey> => d.scope === "resource");

function severity(def: IssueDef<IssueKey>): IssueSeverity {
  return def.tone ?? "info";
}

/**
 * One CSV field per RFC 4180: always quoted, inner quotes doubled. A value starting with
 * `=`, `+`, `-` or `@` gets a leading single quote so a spreadsheet shows it as text instead
 * of evaluating it (CSV injection).
 */
export function csvField(value: string | number): string {
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** A whole CSV document: BOM, quoted fields, CRLF after every row. */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return BOM + rows.map((row) => row.map(csvField).join(",") + LINE_END).join("");
}

function issueColumns(def: IssueDef<IssueKey>): string[] {
  return [def.key, def.label, severity(def), def.group];
}

/**
 * Every URL with every issue it has, one row per (URL, issue) pair: page-scope issues for
 * each crawled page, then resource-scope issues for each resource. Rows follow the same
 * predicates as `countIssues`, so the rows per key add up to the Overview counts.
 */
export function buildIssuesCsv(pages: PageResult[], resources: ResourceResult[], ctx: FilterContext): string {
  const rows: string[][] = [["URL", "Issue Key", "Issue", "Severity", "Group"]];
  for (const page of pages) {
    for (const def of PAGE_DEFS) if (def.test(page, ctx)) rows.push([page.url, ...issueColumns(def)]);
  }
  for (const resource of resources) {
    for (const def of RESOURCE_DEFS) if (def.test(resource, ctx)) rows.push([resource.url, ...issueColumns(def)]);
  }
  return toCsv(rows);
}

/** One row per registry issue, in registry order, with the number of affected URLs
 * (`countIssues`). Issues with no affected URLs are included with a count of 0. */
export function buildIssueSummaryCsv(pages: PageResult[], resources: ResourceResult[], ctx: FilterContext): string {
  const counts = countIssues(pages, resources, ctx);
  const rows: (string | number)[][] = [["Issue Key", "Issue", "Severity", "Group", "Count"]];
  for (const def of ALL_DEFS) rows.push([...issueColumns(def), counts[def.key]]);
  return toCsv(rows);
}
