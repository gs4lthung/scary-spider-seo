import { describe, expect, it } from "vitest";
import type { ExtractionRule, PageResult } from "../types";
import {
  activeExtractions,
  extractedCell,
  getExtractionColumns,
  ingestExtractionIds,
  mergeExtractionRules,
  newExtractionId,
  newExtractionRule,
  reconcileExtractionIds,
} from "./extraction";

function rule(id: string, selector: string, name = "", mode: ExtractionRule["mode"] = "text"): ExtractionRule {
  return { id, name, selector, mode, attr: null };
}

function page(extracted: Record<string, string[]>): PageResult {
  return { extracted } as unknown as PageResult;
}

describe("custom extraction rules", () => {
  it("gives new rules random ex- ids", () => {
    expect(newExtractionId()).toMatch(/^ex-[0-9a-f]{8}$/);
    const fresh = newExtractionRule();
    expect(fresh).toMatchObject({ name: "", selector: "", mode: "text", attr: null });
  });

  it("sends only rules with a selector, with the attribute only in attr mode", () => {
    const rules: ExtractionRule[] = [
      { ...rule("a", ".price"), attr: "left over" },
      rule("b", "   "),
      { ...rule("c", "meta", "", "attr"), attr: " content " },
    ];
    expect(activeExtractions(rules)).toEqual([
      { ...rule("a", ".price"), attr: null },
      { ...rule("c", "meta", "", "attr"), attr: "content" },
    ]);
  });

  it("gives an edited rule a fresh id when a crawl continues", () => {
    const previous = [rule("a", ".price"), { ...rule("b", "meta", "", "attr"), attr: "content" }];
    const { rules, renamed } = reconcileExtractionIds(
      [
        rule("a", ".price", "Renamed only"),
        { ...rule("b", "meta", "", "attr"), attr: "name" },
        rule("c", "h1"),
      ],
      previous,
      () => "fresh",
    );
    expect(rules.map((r) => r.id)).toEqual(["a", "fresh", "c"]);
    expect([...renamed]).toEqual([["b", "fresh"]]);
    // A mode change is a different extraction too.
    const mode = reconcileExtractionIds([rule("a", ".price", "", "inner_html")], previous, () => "m");
    expect(mode.rules[0].id).toBe("m");
  });

  it("keeps earlier rules of a continued crawl when merging", () => {
    const merged = mergeExtractionRules([rule("a", "x", "A"), rule("b", "y", "B")], [rule("b", "y", "B2"), rule("c", "z")]);
    expect(merged.map((r) => [r.id, r.name])).toEqual([
      ["a", "A"],
      ["b", "B2"],
      ["c", ""],
    ]);
  });
});

describe("extraction columns", () => {
  it("builds one column per rule of the crawl, then per unknown id on the pages", () => {
    const ids = new Set<string>();
    ingestExtractionIds(ids, page({ ex1: ["$5"], old: [] }));
    ingestExtractionIds(ids, page({}));
    ingestExtractionIds(ids, page({ ex2: ["x"], ex1: [] }));
    const columns = getExtractionColumns(ids, [
      rule("ex1", ".price", "Price"),
      rule("ex2", ".sale", "Price"),
      rule("ex3", "h1"),
      rule("blank", "  ", "Ignored"),
    ]);
    expect(columns).toEqual([
      { id: "ex1", label: "Price" },
      { id: "ex2", label: "Price (2)" },
      { id: "ex3", label: "h1" },
      { id: "old", label: "Extraction old" },
    ]);
  });

  it("has no columns for a crawl without rules", () => {
    expect(getExtractionColumns([], [])).toEqual([]);
  });

  it("joins a page's values and leaves pages the rule never ran on blank", () => {
    const p = page({ ex1: ["$5", "$7"], ex2: [] });
    expect(extractedCell(p, "ex1")).toBe("$5 | $7");
    expect(extractedCell(p, "ex2")).toBe("");
    expect(extractedCell(p, "ex3")).toBeNull();
  });
});
