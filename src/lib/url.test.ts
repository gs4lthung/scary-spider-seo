import { describe, expect, it } from "vitest";
import { decodeUrlForDisplay, withScheme } from "./url";

describe("withScheme", () => {
  it("prepends https:// when preferHttps is true and no scheme is present", () => {
    expect(withScheme("example.com", true)).toBe("https://example.com");
  });

  it("prepends http:// when preferHttps is false and no scheme is present", () => {
    expect(withScheme("example.com", false)).toBe("http://example.com");
  });

  it("leaves an existing http:// or https:// scheme untouched regardless of preference", () => {
    expect(withScheme("http://example.com", true)).toBe("http://example.com");
    expect(withScheme("https://example.com", false)).toBe("https://example.com");
  });

  it("matches an existing scheme case-insensitively", () => {
    expect(withScheme("HTTPS://example.com", false)).toBe("HTTPS://example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(withScheme("  example.com  ", true)).toBe("https://example.com");
  });

  it("returns an empty string as-is", () => {
    expect(withScheme("", true)).toBe("");
    expect(withScheme("   ", true)).toBe("");
  });
});

describe("decodeUrlForDisplay", () => {
  it("decodes percent-encoded UTF-8 in the path", () => {
    expect(decodeUrlForDisplay("https://example.com/caf%C3%A9")).toBe("https://example.com/café");
  });

  it("keeps reserved characters escaped", () => {
    expect(decodeUrlForDisplay("https://example.com/a%2Fb?q=%26")).toBe("https://example.com/a%2Fb?q=%26");
  });

  it("returns a URL with a malformed escape unchanged", () => {
    expect(decodeUrlForDisplay("https://example.com/%E0%A4%A")).toBe("https://example.com/%E0%A4%A");
  });
});
