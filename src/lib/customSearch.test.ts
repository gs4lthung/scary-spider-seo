import { describe, expect, it } from "vitest";
import type { CustomSearchRule } from "../types";
import { activeCustomSearches, newCustomSearchRule, nextCustomSearchId } from "./customSearch";

const rule = (id: string, pattern = "x"): CustomSearchRule => ({
  id,
  name: "",
  pattern,
  isRegex: false,
  scope: "html",
});

describe("custom search rules", () => {
  it("numbers new ids one past the highest in use", () => {
    expect(nextCustomSearchId([])).toBe("cs1");
    expect(nextCustomSearchId([rule("cs1"), rule("cs3")])).toBe("cs4");
    expect(nextCustomSearchId([rule("other"), rule("cs10")])).toBe("cs11");
  });

  it("creates an empty plain text rule over the HTML", () => {
    expect(newCustomSearchRule([rule("cs2")])).toEqual({
      id: "cs3",
      name: "",
      pattern: "",
      isRegex: false,
      scope: "html",
    });
  });

  it("drops rules with a blank pattern", () => {
    expect(activeCustomSearches([rule("cs1"), rule("cs2", "  "), rule("cs3", " a ")]).map((r) => r.id)).toEqual([
      "cs1",
      "cs3",
    ]);
  });
});
