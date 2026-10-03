import { describe, expect, it } from "vitest";
import { formatPatternLines, parsePatternLines } from "./urlPatterns";

describe("parsePatternLines", () => {
  it("returns one trimmed pattern per line", () => {
    expect(parsePatternLines("/blog/\n  " + String.raw`\.pdf$` + "  ")).toEqual(["/blog/", String.raw`\.pdf$`]);
  });

  it("ignores blank and whitespace-only lines", () => {
    expect(parsePatternLines("\n/a\n\n   \n/b\n")).toEqual(["/a", "/b"]);
  });

  it("handles Windows line endings", () => {
    expect(parsePatternLines("/a\r\n/b")).toEqual(["/a", "/b"]);
  });

  it("returns an empty list for empty input", () => {
    expect(parsePatternLines("")).toEqual([]);
  });
});

describe("formatPatternLines", () => {
  it("joins patterns one per line and round-trips through parsePatternLines", () => {
    const patterns = ["/blog/", String.raw`\?page=`];
    expect(parsePatternLines(formatPatternLines(patterns))).toEqual(patterns);
  });

  it("treats a missing list as empty", () => {
    expect(formatPatternLines(undefined)).toBe("");
  });
});
