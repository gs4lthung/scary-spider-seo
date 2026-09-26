import { describe, expect, it } from "vitest";
import type { CustomSearchRule } from "../types";
import {
  activeCustomSearches,
  mergeCustomSearchRules,
  newCustomSearchId,
  newCustomSearchRule,
  reconcileCustomSearchIds,
} from "./customSearch";

const rule = (id: string, pattern = "x", name = ""): CustomSearchRule => ({
  id,
  name,
  pattern,
  isRegex: false,
  scope: "html",
});

describe("custom search rules", () => {
  it("never reuses an id, even after the newest rule is removed", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) ids.add(newCustomSearchId());
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^cs-[0-9a-f]{8}$/);
  });

  it("creates an empty plain text rule over the HTML", () => {
    const created = newCustomSearchRule();
    expect(created).toEqual({ id: created.id, name: "", pattern: "", isRegex: false, scope: "html" });
  });

  it("drops rules with a blank pattern", () => {
    expect(activeCustomSearches([rule("a"), rule("b", "  "), rule("c", " a ")]).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("gives an edited rule a fresh id when a stopped crawl continues", () => {
    const previous = [rule("a", "old"), rule("b", "same", "Old name")];
    const edited = [rule("a", "new"), rule("b", "same", "New name"), rule("c", "added")];
    const { rules, renamed } = reconcileCustomSearchIds(edited, previous, () => "fresh");
    expect(rules.map((r) => r.id)).toEqual(["fresh", "b", "c"]);
    expect([...renamed]).toEqual([["a", "fresh"]]);
    // A regex flag or scope change is a different search too.
    const regex = reconcileCustomSearchIds([{ ...rule("b", "same"), isRegex: true }], previous, () => "r");
    expect(regex.rules[0].id).toBe("r");
    const scope = reconcileCustomSearchIds([{ ...rule("b", "same"), scope: "text" }], previous, () => "s");
    expect(scope.rules[0].id).toBe("s");
  });

  it("keeps earlier rules of a continued crawl when merging", () => {
    const merged = mergeCustomSearchRules(
      [rule("a", "x", "A"), rule("b", "y", "B")],
      [rule("b", "y", "B renamed"), rule("c", "z", "C")],
    );
    expect(merged.map((r) => [r.id, r.name])).toEqual([
      ["a", "A"],
      ["b", "B renamed"],
      ["c", "C"],
    ]);
  });
});
