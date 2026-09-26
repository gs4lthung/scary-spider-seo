import { describe, expect, it } from "vitest";
import type { PageResult, ResourceResult } from "../types";
import { createLinkGraph } from "./linkGraph";
import { type PageDetailContext, pageDetailFields, resourceDetailFields } from "./detailFields";

function makePage(overrides: Partial<PageResult> = {}): PageResult {
  return {
    url: "https://example.com/",
    depth: 0,
    status: 200,
    statusText: "OK",
    contentType: "text/html",
    title: "A perfectly fine title that is long enough for SEO purposes",
    titleLength: 55,
    metaDescription: "A perfectly fine meta description that is long enough to describe this page to searchers.",
    metaDescriptionLength: 89,
    h1: "Heading",
    h1Count: 1,
    h1Values: ["Heading"],
    h2Values: ["Subheading"],
    h2Count: 1,
    headingLevels: [1, 2],
    titleCount: 1,
    metaDescriptionCount: 1,
    metaRefresh: null,
    paginationNext: null,
    paginationPrev: null,
    wordCount: 500,
    canonical: "https://example.com/",
    metaRobots: null,
    redirectUrl: null,
    indexability: "Indexable",
    responseTimeMs: 100,
    internalLinkCount: 5,
    externalLinkCount: 2,
    imageCount: 3,
    htmlSizeBytes: 10000,
    minifySavingsPct: 5,
    isMinified: true,
    rendered: false,
    hsts: true,
    contentSecurityPolicy: "default-src 'self'",
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
    securityHeadersCaptured: true,
    mixedContentCount: 0,
    insecureLinkCount: 0,
    missingAltCount: 0,
    imagesMissingDimensions: 0,
    lang: "en",
    hreflangValues: [],
    hreflangLinks: [],
    internalNofollowCount: 0,
    outlinks: [],
    textRatioPct: 20,
    contentHash: "hash1",
    contentSimhash: "",
    xRobotsTag: null,
    viewport: "width=device-width",
    hasOpenGraph: true,
    hasTwitterCard: true,
    canonicalCount: 1,
    discoveredViaSitemap: true,
    redirectChain: [],
    structuredDataTypes: ["Article"],
    structuredDataErrors: [],
    accessibilityViolations: [],
    mobileUsabilityViolations: [],
    customSearchCounts: {},
    extracted: {},
    error: null,
    ...overrides,
  };
}

function makeResource(overrides: Partial<ResourceResult> = {}): ResourceResult {
  return {
    url: "https://example.com/image.png",
    resourceType: "image",
    sourcePage: "https://example.com/",
    altText: "An image",
    status: 200,
    statusText: "OK",
    isInternal: true,
    isInsecure: false,
    error: null,
    contentLength: null,
    ...overrides,
  };
}

function ctx(overrides: Partial<PageDetailContext> = {}): PageDetailContext {
  return {
    customSearchColumns: [],
    extractionColumns: [],
    linkGraph: createLinkGraph(),
    linkScores: new Map(),
    nearDuplicates: new Map(),
    ...overrides,
  };
}

function valueOf(fields: { label: string; value: unknown }[], label: string): unknown {
  const field = fields.find((f) => f.label === label);
  expect(field, label).toBeDefined();
  return field?.value;
}

describe("pageDetailFields", () => {
  it("adds one row per custom search and extraction column after Word Count", () => {
    const page = makePage({ customSearchCounts: { s1: 4 }, extracted: { e1: ["a", "b"] } });
    const fields = pageDetailFields(
      page,
      ctx({ customSearchColumns: [{ id: "s1", label: "Price" }], extractionColumns: [{ id: "e1", label: "SKU" }] }),
    );
    const labels = fields.map((f) => f.label);
    const wordCount = labels.indexOf("Word Count");
    expect(labels.slice(wordCount + 1, wordCount + 3)).toEqual(["Custom search: Price", "Extraction: SKU"]);
    expect(valueOf(fields, "Custom search: Price")).toBe(4);
    expect(valueOf(fields, "Extraction: SKU")).toBe("a | b");
  });

  it("shows raw rows only for pages compared with their raw HTML", () => {
    const plain = pageDetailFields(makePage(), ctx());
    expect(plain.some((f) => f.label === "Raw Title")).toBe(false);
    const compared = pageDetailFields(
      makePage({
        raw: {
          title: "Raw",
          metaDescription: null,
          h1: null,
          canonical: null,
          metaRobots: null,
          wordCount: 10,
          internalLinkCount: 1,
        },
      }),
      ctx(),
    );
    expect(valueOf(compared, "Raw Title")).toBe("Raw");
  });

  it("leaves HSTS blank for http pages and reads the link score", () => {
    const page = makePage({ url: "http://example.com/" });
    const fields = pageDetailFields(page, ctx({ linkScores: new Map([["http://example.com/", 42]]) }));
    expect(valueOf(fields, "HSTS")).toBeNull();
    expect(valueOf(fields, "Link Score")).toBe(42);
  });
});

describe("resourceDetailFields", () => {
  it("renders booleans as Yes or No and flags the error row", () => {
    const fields = resourceDetailFields(makeResource({ isInsecure: true, error: "timeout" }));
    expect(valueOf(fields, "Insecure")).toBe("Yes");
    expect(valueOf(fields, "Internal")).toBe("Yes");
    expect(fields.find((f) => f.label === "Error")).toEqual({ label: "Error", value: "timeout", isError: true });
  });
});
