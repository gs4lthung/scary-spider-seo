import { describe, expect, it } from "vitest";
import { isValidHreflang, isXDefault } from "./hreflang";

describe("isValidHreflang", () => {
  it("accepts en and en-GB and x-default", () => {
    expect(isValidHreflang("en")).toBe(true);
    expect(isValidHreflang("en-GB")).toBe(true);
    expect(isValidHreflang("x-default")).toBe(true);
    expect(isValidHreflang("zh-Hant")).toBe(true);
    expect(isValidHreflang("zh-Hans-US")).toBe(true);
  });

  it("rejects en-XX and english", () => {
    expect(isValidHreflang("en-XX")).toBe(false);
    expect(isValidHreflang("english")).toBe(false);
  });

  it("compares case-insensitively", () => {
    expect(isValidHreflang("EN-gb")).toBe(true);
    expect(isValidHreflang("X-Default")).toBe(true);
    expect(isValidHreflang("fr-ca")).toBe(true);
    expect(isValidHreflang("zh-hant-tw")).toBe(true);
  });

  it("rejects unknown languages, non-country regions and wrong separators", () => {
    expect(isValidHreflang("xx")).toBe(false);
    expect(isValidHreflang("en-UK")).toBe(false);
    expect(isValidHreflang("en-EU")).toBe(false);
    expect(isValidHreflang("en_GB")).toBe(false);
    expect(isValidHreflang("zh-Xxxx")).toBe(false);
    expect(isValidHreflang("zh-US-Hans")).toBe(false);
    expect(isValidHreflang("eng")).toBe(false);
    expect(isValidHreflang("")).toBe(false);
  });
});

describe("isXDefault", () => {
  it("matches x-default in any case only", () => {
    expect(isXDefault("X-DEFAULT")).toBe(true);
    expect(isXDefault("en")).toBe(false);
  });
});
