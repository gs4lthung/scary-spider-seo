import { describe, expect, it } from "vitest";
import type { LinkRef, PageResult, ResourceResult } from "../types";
import { ISSUE_SOLUTIONS } from "./issueSolutions";
import { META_FONT_PX, TITLE_FONT_PX, estimatePixelWidth } from "./pixelWidth";
import {
  type FilterContext,
  type FilterKey,
  DEEP_PAGE_DEPTH,
  H1_MAX_LENGTH,
  H2_MAX_LENGTH,
  ISSUE_DEFS,
  LARGE_HTML_BYTES,
  LARGE_IMAGE_BYTES,
  LOW_WORD_COUNT,
  LOW_TEXT_RATIO_THRESHOLD_PCT,
  NON_DESCRIPTIVE_ANCHORS,
  META_MAX_LENGTH,
  META_MAX_PIXELS,
  META_MIN_LENGTH,
  META_MIN_PIXELS,
  SLOW_RESPONSE_THRESHOLD_MS,
  TITLE_MAX_LENGTH,
  TITLE_MAX_PIXELS,
  TITLE_MIN_LENGTH,
  TITLE_MIN_PIXELS,
  URL_MAX_LENGTH,
  countIssues,
  createDuplicateTracker,
  emptyFilterContext,
  filterPages,
  filterResources,
  filterTab,
  getCanonicalStatusMap,
  getDuplicateContentSet,
  getDuplicateH1Set,
  getDuplicateH2Set,
  getDuplicateMetaSet,
  getDuplicateTitleSet,
  getMetaPixelWidth,
  getNon200LinkSourceSet,
  getPageByUrlMap,
  getPageIssueKeys,
  getResourceIssueKeys,
  getSitemapUsed,
  getTitlePixelWidth,
  hasHeadingLevelSkip,
  isNon200LinkTarget,
  isNonDescriptiveAnchor,
  ingestDuplicateValue,
  ingestNon200LinkSources,
  createHreflangTracker,
  getHreflangTracker,
  ingestHreflangPage,
  parseRobotsDirectives,
  searchPages,
  searchResources,
} from "./filters";
import { addPageToLinkGraph, buildLinkGraph, createLinkGraph } from "./linkGraph";
import { createNearDuplicateTracker, getNearDuplicateClusters, ingestNearDuplicatePage } from "./nearDuplicates";

function nearDuplicateContext(pages: PageResult[]) {
  const tracker = createNearDuplicateTracker();
  for (const p of pages) ingestNearDuplicatePage(tracker, p);
  return getNearDuplicateClusters(tracker);
}

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

describe("getDuplicateTitleSet", () => {
  it("flags titles shared by more than one page", () => {
    const pages = [makePage({ title: "Same" }), makePage({ title: "Same" }), makePage({ title: "Unique" })];
    const dupes = getDuplicateTitleSet(pages);
    expect(dupes.has("Same")).toBe(true);
    expect(dupes.has("Unique")).toBe(false);
  });

  it("ignores pages with no title", () => {
    const pages = [makePage({ title: null }), makePage({ title: null })];
    expect(getDuplicateTitleSet(pages).size).toBe(0);
  });
});

describe("getDuplicateContentSet", () => {
  it("flags content hashes shared by more than one page", () => {
    const pages = [makePage({ contentHash: "a" }), makePage({ contentHash: "a" }), makePage({ contentHash: "b" })];
    const dupes = getDuplicateContentSet(pages);
    expect(dupes.has("a")).toBe(true);
    expect(dupes.has("b")).toBe(false);
  });
});

describe("getDuplicateMetaSet", () => {
  it("flags meta descriptions shared by more than one page", () => {
    const pages = [
      makePage({ metaDescription: "Same desc" }),
      makePage({ metaDescription: "Same desc" }),
      makePage({ metaDescription: "Other desc" }),
    ];
    const dupes = getDuplicateMetaSet(pages);
    expect(dupes.has("Same desc")).toBe(true);
    expect(dupes.has("Other desc")).toBe(false);
  });
});

describe("getCanonicalStatusMap", () => {
  it("maps each page's url to its status", () => {
    const pages = [makePage({ url: "https://example.com/a", status: 200 }), makePage({ url: "https://example.com/b", status: 404 })];
    const map = getCanonicalStatusMap(pages);
    expect(map.get("https://example.com/a")).toBe(200);
    expect(map.get("https://example.com/b")).toBe(404);
    expect(map.has("https://example.com/missing")).toBe(false);
  });
});

describe("DuplicateTracker (incremental duplicate detection)", () => {
  it("adds a value to `duplicates` the moment a second occurrence is ingested", () => {
    const tracker = createDuplicateTracker();
    ingestDuplicateValue(tracker, "Same");
    expect(tracker.duplicates.has("Same")).toBe(false);
    ingestDuplicateValue(tracker, "Same");
    expect(tracker.duplicates.has("Same")).toBe(true);
  });

  it("ignores null/undefined/empty values", () => {
    const tracker = createDuplicateTracker();
    ingestDuplicateValue(tracker, null);
    ingestDuplicateValue(tracker, undefined);
    ingestDuplicateValue(tracker, "");
    expect(tracker.duplicates.size).toBe(0);
    expect(tracker.counts.size).toBe(0);
  });

  it("matches getDuplicateTitleSet when fed the same pages one at a time, in any batching", () => {
    const pages = [
      makePage({ title: "A" }),
      makePage({ title: "B" }),
      makePage({ title: "A" }),
      makePage({ title: null }),
      makePage({ title: "C" }),
      makePage({ title: "B" }),
      makePage({ title: "A" }),
    ];
    const tracker = createDuplicateTracker();
    for (const p of pages) ingestDuplicateValue(tracker, p.title);
    expect(tracker.duplicates).toEqual(getDuplicateTitleSet(pages));
  });
});

describe("filterTab", () => {
  it("routes 'broken' to resources and everything else (except 'all') to pages", () => {
    expect(filterTab("broken")).toBe("resources");
    expect(filterTab("all")).toBe(null);
    expect(filterTab("missingTitle")).toBe("pages");
  });
});

describe("filterPages", () => {
  function run(pages: PageResult[], filter: Parameters<typeof filterPages>[1]) {
    return filterPages(pages, filter, emptyFilterContext());
  }

  it("returns everything for 'all'", () => {
    const pages = [makePage(), makePage({ status: 404 })];
    expect(run(pages, "all")).toHaveLength(2);
  });

  it("filters by status class (2xx/3xx/4xx5xx)", () => {
    const pages = [makePage({ status: 200 }), makePage({ status: 301 }), makePage({ status: 404 }), makePage({ status: null })];
    expect(run(pages, "2xx")).toEqual([pages[0]]);
    expect(run(pages, "3xx")).toEqual([pages[1]]);
    expect(run(pages, "4xx5xx")).toEqual([pages[2], pages[3]]);
  });

  it("flags missing title", () => {
    const pages = [makePage({ title: null }), makePage({ title: "Has one" })];
    expect(run(pages, "missingTitle")).toEqual([pages[0]]);
  });

  it("flags duplicate titles using the provided set", () => {
    const pages = [makePage({ title: "Dup" }), makePage({ title: "Solo" })];
    const result = filterPages(pages, "duplicateTitles", { ...emptyFilterContext(), duplicateTitles: new Set(["Dup"]) });
    expect(result).toEqual([pages[0]]);
  });

  it("flags missing meta description", () => {
    const pages = [makePage({ metaDescription: null }), makePage()];
    expect(run(pages, "missingMeta")).toEqual([pages[0]]);
  });

  it("flags h1 count anything other than exactly one", () => {
    const pages = [makePage({ h1Count: 0 }), makePage({ h1Count: 1 }), makePage({ h1Count: 2 })];
    expect(run(pages, "h1Issues")).toEqual([pages[0], pages[2]]);
  });

  it("flags unminified pages that actually have html", () => {
    const pages = [
      makePage({ htmlSizeBytes: 1000, isMinified: false }),
      makePage({ htmlSizeBytes: 1000, isMinified: true }),
      makePage({ htmlSizeBytes: 0, isMinified: false }),
    ];
    expect(run(pages, "unminified")).toEqual([pages[0]]);
  });

  it("flags pages with images missing width or height", () => {
    const pages = [makePage({ imagesMissingDimensions: 1 }), makePage({ imagesMissingDimensions: 0 })];
    expect(run(pages, "imageMissingDimensions")).toEqual([pages[0]]);
    expect(getPageIssueKeys(pages[0], emptyFilterContext())).toContain("imageMissingDimensions");
    expect(getPageIssueKeys(pages[1], emptyFilterContext())).not.toContain("imageMissingDimensions");
  });

  it("flags missing alt text and insecure links by count", () => {
    const pages = [makePage({ missingAltCount: 2 }), makePage({ missingAltCount: 0 })];
    expect(run(pages, "missingAlt")).toEqual([pages[0]]);

    const insecurePages = [makePage({ insecureLinkCount: 1 }), makePage({ insecureLinkCount: 0 })];
    expect(run(insecurePages, "insecureLinks")).toEqual([insecurePages[0]]);
  });

  it("flags missing HSTS only for https pages", () => {
    const pages = [
      makePage({ url: "https://example.com/a", hsts: false }),
      makePage({ url: "https://example.com/b", hsts: true }),
      makePage({ url: "http://example.com/c", hsts: false }),
    ];
    expect(run(pages, "missingHsts")).toEqual([pages[0]]);
  });

  it("flags mixed content only on https pages", () => {
    const pages = [
      makePage({ url: "https://example.com/a", mixedContentCount: 2 }),
      makePage({ url: "https://example.com/b", mixedContentCount: 0 }),
      makePage({ url: "http://example.com/c", mixedContentCount: 1 }),
    ];
    expect(run(pages, "mixedContent")).toEqual([pages[0]]);
    expect(getPageIssueKeys(pages[0], emptyFilterContext())).toContain("mixedContent");
  });

  it("flags a missing or blank Content-Security-Policy", () => {
    const pages = [
      makePage({ contentSecurityPolicy: null }),
      makePage({ contentSecurityPolicy: "  " }),
      makePage({ contentSecurityPolicy: "default-src 'self'" }),
    ];
    expect(run(pages, "missingCsp")).toEqual([pages[0], pages[1]]);
  });

  it("accepts X-Frame-Options or CSP frame-ancestors for frame protection", () => {
    const pages = [
      makePage({ xFrameOptions: null, contentSecurityPolicy: "default-src 'self'" }),
      makePage({ xFrameOptions: "SAMEORIGIN", contentSecurityPolicy: null }),
      makePage({ xFrameOptions: null, contentSecurityPolicy: "default-src 'self'; Frame-Ancestors 'none'" }),
      makePage({ xFrameOptions: null, contentSecurityPolicy: "frame-ancestors 'self'" }),
    ];
    expect(run(pages, "missingFrameOptions")).toEqual([pages[0]]);
  });

  it("requires X-Content-Type-Options to be nosniff", () => {
    const pages = [
      makePage({ xContentTypeOptions: null }),
      makePage({ xContentTypeOptions: "sniff" }),
      makePage({ xContentTypeOptions: " NoSniff " }),
    ];
    expect(run(pages, "missingContentTypeOptions")).toEqual([pages[0], pages[1]]);
  });

  it("flags a missing Referrer-Policy", () => {
    const pages = [makePage({ referrerPolicy: null }), makePage({ referrerPolicy: "no-referrer" })];
    expect(run(pages, "missingReferrerPolicy")).toEqual([pages[0]]);
  });

  it("skips security header checks for non-HTML pages and crawls saved before the headers were captured", () => {
    const noHeaders = {
      contentSecurityPolicy: null,
      xFrameOptions: null,
      xContentTypeOptions: null,
      referrerPolicy: null,
    };
    const pages = [
      makePage({ ...noHeaders }),
      makePage({ ...noHeaders, securityHeadersCaptured: false }),
      makePage({ ...noHeaders, htmlSizeBytes: 0 }),
    ];
    for (const key of ["missingCsp", "missingFrameOptions", "missingContentTypeOptions", "missingReferrerPolicy"] as const) {
      expect(run(pages, key)).toEqual([pages[0]]);
      expect(getPageIssueKeys(pages[0], emptyFilterContext())).toContain(key);
      expect(getPageIssueKeys(pages[1], emptyFilterContext())).not.toContain(key);
    }
  });

  it("flags title length outside the min/max bounds", () => {
    const short = makePage({ title: "Short", titleLength: TITLE_MIN_LENGTH - 1 });
    const long = makePage({ title: "Long", titleLength: TITLE_MAX_LENGTH + 1 });
    const fine = makePage({ title: "Fine", titleLength: (TITLE_MIN_LENGTH + TITLE_MAX_LENGTH) / 2 });
    const noTitle = makePage({ title: null, titleLength: 0 });

    expect(run([short, fine], "titleTooShort")).toEqual([short]);
    expect(run([long, fine], "titleTooLong")).toEqual([long]);
    // titleTooShort requires a title to exist — a missing title is a separate issue (missingTitle)
    expect(run([noTitle], "titleTooShort")).toEqual([]);
  });

  it("flags missing lang/hreflang only when the page actually has html", () => {
    const pages = [
      makePage({ htmlSizeBytes: 1000, lang: null }),
      makePage({ htmlSizeBytes: 1000, lang: "en" }),
      makePage({ htmlSizeBytes: 0, lang: null }),
    ];
    expect(run(pages, "missingLang")).toEqual([pages[0]]);

    const hreflangPages = [
      makePage({ htmlSizeBytes: 1000, hreflangValues: [] }),
      makePage({ htmlSizeBytes: 1000, hreflangValues: ["en"] }),
    ];
    expect(run(hreflangPages, "missingHreflang")).toEqual([hreflangPages[0]]);
  });

  it("flags duplicate content using the provided set", () => {
    const pages = [makePage({ contentHash: "dup" }), makePage({ contentHash: "solo" })];
    const result = filterPages(pages, "duplicateContent", { ...emptyFilterContext(), duplicateContent: new Set(["dup"]) });
    expect(result).toEqual([pages[0]]);
  });

  it("flags low text/html ratio", () => {
    const pages = [
      makePage({ htmlSizeBytes: 1000, textRatioPct: LOW_TEXT_RATIO_THRESHOLD_PCT - 1 }),
      makePage({ htmlSizeBytes: 1000, textRatioPct: LOW_TEXT_RATIO_THRESHOLD_PCT + 1 }),
      makePage({ htmlSizeBytes: 0, textRatioPct: 0 }),
    ];
    expect(run(pages, "lowTextRatio")).toEqual([pages[0]]);
  });

  it("flags nofollow links by count", () => {
    const pages = [makePage({ internalNofollowCount: 1 }), makePage({ internalNofollowCount: 0 })];
    expect(run(pages, "nofollowLinks")).toEqual([pages[0]]);
  });

  it("flags duplicate meta descriptions using the provided set", () => {
    const pages = [makePage({ metaDescription: "dup" }), makePage({ metaDescription: "solo" })];
    const result = filterPages(pages, "duplicateMeta", { ...emptyFilterContext(), duplicateMeta: new Set(["dup"]) });
    expect(result).toEqual([pages[0]]);
  });

  it("flags multiple canonical tags", () => {
    const pages = [makePage({ canonicalCount: 2 }), makePage({ canonicalCount: 1 })];
    expect(run(pages, "multipleCanonical")).toEqual([pages[0]]);
  });

  it("flags a broken canonical target (dead or unknown-but-crawled)", () => {
    const canonicalStatusMap = new Map<string, number | null>([
      ["https://example.com/dead", 404],
      ["https://example.com/alive", 200],
    ]);
    const pages = [
      makePage({ url: "https://example.com/a", canonical: "https://example.com/dead" }),
      makePage({ url: "https://example.com/b", canonical: "https://example.com/alive" }),
      // self-canonical never counts as broken
      makePage({ url: "https://example.com/c", canonical: "https://example.com/c" }),
      // canonical target that was never crawled is not flagged (we can't know its status)
      makePage({ url: "https://example.com/d", canonical: "https://example.com/never-crawled" }),
    ];
    const result = filterPages(pages, "brokenCanonicalTarget", { ...emptyFilterContext(), canonicalStatusMap });
    expect(result).toEqual([pages[0]]);
  });

  it("flags slow responses", () => {
    const pages = [
      makePage({ responseTimeMs: SLOW_RESPONSE_THRESHOLD_MS + 1 }),
      makePage({ responseTimeMs: SLOW_RESPONSE_THRESHOLD_MS - 1 }),
    ];
    expect(run(pages, "slowResponse")).toEqual([pages[0]]);
  });

  it("flags missing viewport and missing social tags only for html pages", () => {
    const viewportPages = [makePage({ htmlSizeBytes: 1000, viewport: null }), makePage({ htmlSizeBytes: 0, viewport: null })];
    expect(run(viewportPages, "missingViewport")).toEqual([viewportPages[0]]);

    const socialPages = [
      makePage({ htmlSizeBytes: 1000, hasOpenGraph: false, hasTwitterCard: false }),
      makePage({ htmlSizeBytes: 1000, hasOpenGraph: true, hasTwitterCard: false }),
    ];
    expect(run(socialPages, "missingSocialTags")).toEqual([socialPages[0]]);
  });

  it("flags long redirect chains", () => {
    const pages = [makePage({ redirectChain: ["a", "b"] }), makePage({ redirectChain: ["a"] }), makePage({ redirectChain: [] })];
    expect(run(pages, "redirectChainTooLong")).toEqual([pages[0]]);
  });

  it("flags orphan pages (in sitemap, not linked internally)", () => {
    const pages = [
      makePage({ url: "https://example.com/orphan", discoveredViaSitemap: true }),
      makePage({ url: "https://example.com/linked", discoveredViaSitemap: true }),
      makePage({ url: "https://example.com/not-in-sitemap", discoveredViaSitemap: false }),
    ];
    const result = filterPages(pages, "orphanPage", { ...emptyFilterContext(), linkedUrls: new Set(["https://example.com/linked"]) });
    expect(result).toEqual([pages[0]]);
  });

  it("flags structured data errors and missing structured data", () => {
    const errorPages = [makePage({ structuredDataErrors: ["bad json"] }), makePage({ structuredDataErrors: [] })];
    expect(run(errorPages, "structuredDataErrors")).toEqual([errorPages[0]]);

    const missingPages = [
      makePage({ htmlSizeBytes: 1000, structuredDataTypes: [] }),
      makePage({ htmlSizeBytes: 1000, structuredDataTypes: ["Article"] }),
      makePage({ htmlSizeBytes: 0, structuredDataTypes: [] }),
    ];
    expect(run(missingPages, "missingStructuredData")).toEqual([missingPages[0]]);
  });

  it("flags accessibility violations", () => {
    const violation = { id: "v1", impact: "serious", description: "d", helpUrl: "u", nodeCount: 1 };
    const pages = [makePage({ accessibilityViolations: [violation] }), makePage({ accessibilityViolations: [] })];
    expect(run(pages, "accessibilityIssues")).toEqual([pages[0]]);
  });

  it("flags mobile usability violations", () => {
    const violation = { id: "content-width", description: "d", helpUrl: "u", nodeCount: 1 };
    const pages = [
      makePage({ mobileUsabilityViolations: [violation] }),
      makePage({ mobileUsabilityViolations: [] }),
    ];
    expect(run(pages, "mobileUsabilityIssues")).toEqual([pages[0]]);
  });
});

describe("filterResources", () => {
  it("returns everything unless the filter is 'broken'", () => {
    const resources = [makeResource({ status: 200 }), makeResource({ status: 404 })];
    expect(filterResources(resources, "all")).toHaveLength(2);
  });

  it("flags resources with a 4xx/5xx status or an error", () => {
    const resources = [
      makeResource({ status: 404 }),
      makeResource({ status: 200, error: "timeout" }),
      makeResource({ status: 200, error: null }),
      makeResource({ status: null, error: null }),
    ];
    expect(filterResources(resources, "broken")).toEqual([resources[0], resources[1]]);
  });
});

describe("getPageIssueKeys", () => {
  it("returns no issues for a page with nothing wrong", () => {
    // hreflangValues/discoveredViaSitemap need explicit non-default values here since makePage()'s
    // defaults (empty hreflang, discovered via sitemap) are themselves flagged issues otherwise.
    const page = makePage({ hreflangValues: ["en"], discoveredViaSitemap: false });
    const keys = getPageIssueKeys(page, emptyFilterContext());
    expect(keys).toEqual([]);
  });

  it("returns every applicable issue key for a page with many problems", () => {
    const page = makePage({ status: 404, title: null, metaDescription: null, h1Count: 0 });
    const keys = getPageIssueKeys(page, emptyFilterContext());
    expect(keys).toEqual(expect.arrayContaining(["4xx5xx", "missingTitle", "missingMeta", "h1Issues"]));
  });

  it("stays in sync with filterPages for every issue key (single source of truth)", () => {
    // A no-issues page and a many-issues page, checked against filterPages directly rather than
    // re-deriving the "what counts as an issue" rules a second time in this test.
    const pages = [makePage(), makePage({ status: 404, title: null, canonicalCount: 2, insecureLinkCount: 1 })];
    for (const page of pages) {
      const keys = getPageIssueKeys(page, emptyFilterContext());
      for (const key of keys) {
        expect(filterPages([page], key, emptyFilterContext())).toHaveLength(1);
      }
    }
  });
});

describe("searchPages", () => {
  const pages = [
    makePage({ url: "https://example.com/blog/hello-world", title: "Hello World", metaDescription: "A greeting", h1: "Hi" }),
    makePage({ url: "https://example.com/about", title: "About us", metaDescription: "Company info", h1: "About" }),
  ];

  it("returns everything for an empty or whitespace-only query", () => {
    expect(searchPages(pages, "")).toEqual(pages);
    expect(searchPages(pages, "   ")).toEqual(pages);
  });

  it("matches case-insensitively against url, title, meta description, and h1", () => {
    expect(searchPages(pages, "HELLO")).toEqual([pages[0]]);
    expect(searchPages(pages, "about us")).toEqual([pages[1]]);
    expect(searchPages(pages, "greeting")).toEqual([pages[0]]);
    expect(searchPages(pages, "Hi")).toEqual([pages[0]]);
  });

  it("tolerates null title/metaDescription/h1", () => {
    const page = makePage({ title: null, metaDescription: null, h1: null, url: "https://example.com/x" });
    expect(searchPages([page], "example.com/x")).toEqual([page]);
    expect(searchPages([page], "nomatch")).toEqual([]);
  });
});

describe("searchResources", () => {
  const resources = [
    makeResource({ url: "https://example.com/logo.png", sourcePage: "https://example.com/", altText: "Site logo" }),
    makeResource({ url: "https://cdn.example.com/hero.jpg", sourcePage: "https://example.com/about", altText: null }),
  ];

  it("returns everything for an empty query", () => {
    expect(searchResources(resources, "")).toEqual(resources);
  });

  it("matches case-insensitively against url, source page, and alt text", () => {
    expect(searchResources(resources, "LOGO")).toEqual([resources[0]]);
    expect(searchResources(resources, "/about")).toEqual([resources[1]]);
    expect(searchResources(resources, "cdn.example")).toEqual([resources[1]]);
  });

  it("tolerates null alt text", () => {
    expect(searchResources(resources, "hero")).toEqual([resources[1]]);
  });
});

describe("largeImage", () => {
  it("flags images over 100 KB by Content-Length, with the boundary not flagged", () => {
    const resources = [
      makeResource({ contentLength: LARGE_IMAGE_BYTES + 1 }),
      makeResource({ contentLength: LARGE_IMAGE_BYTES }),
      makeResource({ contentLength: null }),
      makeResource({ resourceType: "link", contentLength: LARGE_IMAGE_BYTES * 10 }),
    ];
    expect(filterTab("largeImage")).toBe("resources");
    expect(filterResources(resources, "largeImage")).toEqual([resources[0]]);
    expect(getResourceIssueKeys(resources[0])).toEqual(["largeImage"]);
    expect(getResourceIssueKeys(resources[2])).toEqual([]);
  });
});

describe("getResourceIssueKeys", () => {
  it("flags broken resources and insecure resources", () => {
    expect(getResourceIssueKeys(makeResource({ status: 404 }))).toEqual(["broken"]);
    expect(getResourceIssueKeys(makeResource({ isInsecure: true }))).toEqual(["insecureLinks"]);
    expect(getResourceIssueKeys(makeResource({ status: 404, isInsecure: true }))).toEqual(["broken", "insecureLinks"]);
    expect(getResourceIssueKeys(makeResource())).toEqual([]);
  });
});

describe("URL structure issues", () => {
  const run = (url: string, key: FilterKey, overrides: Partial<PageResult> = {}) =>
    filterPages([makePage({ url, ...overrides })], key, emptyFilterContext()).length === 1;

  it("urlUppercase flags uppercase in the path", () => {
    expect(run("https://example.com/About-Us", "urlUppercase")).toBe(true);
  });

  it("urlUppercase ignores the host and percent-escape hex digits", () => {
    expect(run("https://Example.COM/about-us", "urlUppercase")).toBe(false);
    expect(run("https://example.com/caf%C3%A9", "urlUppercase")).toBe(false);
  });

  it("urlUnderscores flags an underscore in the path or query", () => {
    expect(run("https://example.com/about_us", "urlUnderscores")).toBe(true);
    expect(run("https://example.com/about?utm_source=x", "urlUnderscores")).toBe(true);
  });

  it("urlUnderscores ignores hyphenated URLs and underscores in the host", () => {
    expect(run("https://my_host.example.com/about-us", "urlUnderscores")).toBe(false);
  });

  it("urlParameters flags a query string", () => {
    expect(run("https://example.com/list?page=2", "urlParameters")).toBe(true);
  });

  it("urlParameters ignores URLs without a query", () => {
    expect(run("https://example.com/list", "urlParameters")).toBe(false);
  });

  it("urlParameters ignores a bare trailing question mark", () => {
    expect(run("https://example.com/list?", "urlParameters")).toBe(false);
  });

  it("urlOver115 flags a URL one character over the limit, not one at the limit", () => {
    const base = "https://example.com/";
    const atLimit = base + "a".repeat(URL_MAX_LENGTH - base.length);
    expect(atLimit).toHaveLength(URL_MAX_LENGTH);
    expect(run(atLimit, "urlOver115")).toBe(false);
    expect(run(atLimit + "a", "urlOver115")).toBe(true);
  });

  it("urlNonAscii detects percent-encoded UTF-8 path", () => {
    expect(run("https://example.com/caf%C3%A9", "urlNonAscii")).toBe(true);
    expect(run("https://example.com/%e6%97%a5%e6%9c%ac", "urlNonAscii")).toBe(true);
  });

  it("urlNonAscii ignores percent-encoded ASCII such as spaces", () => {
    expect(run("https://example.com/my%20page", "urlNonAscii")).toBe(false);
  });

  it("urlNonAscii ignores an internationalised (punycode) host", () => {
    expect(run("https://xn--caf-dma.example/menu", "urlNonAscii")).toBe(false);
  });

  it("urlMultipleSlashes flags repeated slashes in the path", () => {
    expect(run("https://example.com/a//b.html", "urlMultipleSlashes")).toBe(true);
  });

  it("urlMultipleSlashes ignores the scheme's slashes and slashes in the query", () => {
    expect(run("https://example.com/a/b.html", "urlMultipleSlashes")).toBe(false);
    expect(run("https://example.com/go?to=https://other.example/", "urlMultipleSlashes")).toBe(false);
  });

  it("only flags URLs that answered 2xx or 3xx", () => {
    const url = `https://example.com/Caf%C3%A9_path//${"x".repeat(URL_MAX_LENGTH)}?y=1`;
    const urlKeys: FilterKey[] = [
      "urlUppercase",
      "urlUnderscores",
      "urlParameters",
      "urlOver115",
      "urlNonAscii",
      "urlMultipleSlashes",
    ];
    for (const key of urlKeys) {
      expect(run(url, key, { status: 200 }), key).toBe(true);
      expect(run(url, key, { status: 301 }), key).toBe(true);
      for (const status of [404, 500, null]) expect(run(url, key, { status }), `${key} ${status}`).toBe(false);
    }
  });

  it("reports the URL issues in getPageIssueKeys", () => {
    const page = makePage({ url: "https://example.com/Caf%C3%A9_menu//x?y=1", hreflangValues: ["en"], discoveredViaSitemap: false });
    expect(getPageIssueKeys(page, emptyFilterContext())).toEqual([
      "urlUppercase",
      "urlUnderscores",
      "urlParameters",
      "urlNonAscii",
      "urlMultipleSlashes",
    ]);
  });
});

describe("title, meta description and H1 length issues", () => {
  const run = (key: FilterKey, overrides: Partial<PageResult>) =>
    filterPages([makePage(overrides)], key, emptyFilterContext()).length === 1;

  /** The longest run of `unit` whose estimated width does not exceed `maxPx`. */
  function widestUpTo(unit: string, maxPx: number, fontPx: number): string {
    let text = unit;
    while (estimatePixelWidth(text + unit, fontPx) <= maxPx) text += unit;
    return text;
  }

  /** The shortest run of `unit` whose estimated width reaches `minPx`. */
  function narrowestFrom(unit: string, minPx: number, fontPx: number): string {
    let text = unit;
    while (estimatePixelWidth(text, fontPx) < minPx) text += unit;
    return text;
  }

  it("titleOverPixels flags a title one glyph wider than the limit, not one at it", () => {
    const atLimit = widestUpTo("a", TITLE_MAX_PIXELS, TITLE_FONT_PX);
    expect(run("titleOverPixels", { title: atLimit })).toBe(false);
    expect(run("titleOverPixels", { title: atLimit + "a" })).toBe(true);
    expect(run("titleOverPixels", { title: "W".repeat(40) })).toBe(true);
  });

  it("titleOverPixels ignores a missing title", () => {
    expect(run("titleOverPixels", { title: null })).toBe(false);
  });

  it("titleUnderPixels flags a title one glyph narrower than the limit, not one at it", () => {
    const atLimit = narrowestFrom("a", TITLE_MIN_PIXELS, TITLE_FONT_PX);
    expect(run("titleUnderPixels", { title: atLimit })).toBe(false);
    expect(run("titleUnderPixels", { title: atLimit.slice(1) })).toBe(true);
    expect(run("titleUnderPixels", { title: "Home" })).toBe(true);
  });

  it("titleUnderPixels ignores the default title and a missing title", () => {
    expect(run("titleUnderPixels", {})).toBe(false);
    expect(run("titleUnderPixels", { title: null })).toBe(false);
  });

  it("titleSameAsH1 flags a title equal to the H1 ignoring case and whitespace", () => {
    expect(run("titleSameAsH1", { title: "Blue  Widgets\n", h1: " blue widgets" })).toBe(true);
  });

  it("titleSameAsH1 ignores a different H1 and a missing one", () => {
    expect(run("titleSameAsH1", { title: "Blue widgets", h1: "Blue widgets for sale" })).toBe(false);
    expect(run("titleSameAsH1", { title: "Blue widgets", h1: null })).toBe(false);
    expect(run("titleSameAsH1", { title: null, h1: null })).toBe(false);
    expect(run("titleSameAsH1", { title: " ", h1: " " })).toBe(false);
  });

  it("metaTooLong flags a description one character over the limit, not at it", () => {
    expect(run("metaTooLong", { metaDescriptionLength: META_MAX_LENGTH + 1 })).toBe(true);
    expect(run("metaTooLong", { metaDescriptionLength: META_MAX_LENGTH })).toBe(false);
  });

  it("metaTooLong ignores a missing description", () => {
    expect(run("metaTooLong", { metaDescription: null, metaDescriptionLength: META_MAX_LENGTH + 1 })).toBe(false);
  });

  it("metaTooShort flags a description one character under the limit, not at it", () => {
    expect(run("metaTooShort", { metaDescriptionLength: META_MIN_LENGTH - 1 })).toBe(true);
    expect(run("metaTooShort", { metaDescriptionLength: META_MIN_LENGTH })).toBe(false);
  });

  it("metaTooShort ignores a missing description", () => {
    expect(run("metaTooShort", { metaDescription: null, metaDescriptionLength: 0 })).toBe(false);
  });

  it("metaOverPixels flags a description one glyph wider than the limit, not one at it", () => {
    const atLimit = widestUpTo("a", META_MAX_PIXELS, META_FONT_PX);
    expect(run("metaOverPixels", { metaDescription: atLimit })).toBe(false);
    expect(run("metaOverPixels", { metaDescription: atLimit + "a" })).toBe(true);
  });

  it("metaOverPixels ignores the default description and a missing one", () => {
    expect(run("metaOverPixels", {})).toBe(false);
    expect(run("metaOverPixels", { metaDescription: null })).toBe(false);
  });

  it("metaUnderPixels flags a description one glyph narrower than the limit, not one at it", () => {
    const atLimit = narrowestFrom("a", META_MIN_PIXELS, META_FONT_PX);
    expect(run("metaUnderPixels", { metaDescription: atLimit })).toBe(false);
    expect(run("metaUnderPixels", { metaDescription: atLimit.slice(1) })).toBe(true);
  });

  it("metaUnderPixels ignores the default description and a missing one", () => {
    expect(run("metaUnderPixels", {})).toBe(false);
    expect(run("metaUnderPixels", { metaDescription: null })).toBe(false);
  });

  it("h1TooLong flags an H1 one character over the limit, not at it", () => {
    expect(run("h1TooLong", { h1: "h".repeat(H1_MAX_LENGTH + 1) })).toBe(true);
    expect(run("h1TooLong", { h1: "h".repeat(H1_MAX_LENGTH) })).toBe(false);
  });

  it("h1TooLong ignores a missing H1 and surrounding whitespace", () => {
    expect(run("h1TooLong", { h1: null })).toBe(false);
    expect(run("h1TooLong", { h1: `  ${"h".repeat(H1_MAX_LENGTH)}  ` })).toBe(false);
  });

  it("reports the new issues in getPageIssueKeys", () => {
    const page = makePage({
      hreflangValues: ["en"],
      discoveredViaSitemap: false,
      title: "Blue widgets",
      titleLength: 12,
      h1: "Blue widgets",
      metaDescription: "Widgets",
      metaDescriptionLength: 7,
    });
    expect(getPageIssueKeys(page, emptyFilterContext())).toEqual([
      "titleTooShort",
      "titleUnderPixels",
      "titleSameAsH1",
      "metaTooShort",
      "metaUnderPixels",
    ]);
  });

  it("pixel width helpers measure the title and meta description at their SERP font sizes", () => {
    const page = makePage();
    expect(getTitlePixelWidth(page)).toBe(estimatePixelWidth(page.title ?? "", TITLE_FONT_PX));
    expect(getMetaPixelWidth(page)).toBe(estimatePixelWidth(page.metaDescription ?? "", META_FONT_PX));
    expect(getTitlePixelWidth(makePage({ title: null }))).toBe(0);
    expect(getMetaPixelWidth(makePage({ metaDescription: null }))).toBe(0);
  });
});

describe("issue registry", () => {
  const violation = { id: "x", description: "x", helpUrl: "https://example.com/help", nodeCount: 1 };

  // One page per issue (plus shared defaults that trigger the cross-page issues), so every
  // registry key is hit at least once.
  function mixedCrawl() {
    const at = (path: string, overrides: Partial<PageResult> = {}) =>
      makePage({ url: `https://example.com/${path}`, canonical: `https://example.com/${path}`, ...overrides });
    const pages = [
      at("clean", { hreflangValues: ["en"], discoveredViaSitemap: false, contentHash: "unique", title: "Unique" }),
      at("gone", { status: 404 }),
      at("hreflang-en", {
        hreflangLinks: [
          { lang: "en", href: "https://example.com/hreflang-en" },
          { lang: "fr", href: "https://example.com/hreflang-fr" },
          { lang: "de", href: "https://example.com/clean" },
          { lang: "it", href: "https://example.com/gone" },
        ],
      }),
      at("hreflang-fr", { hreflangLinks: [{ lang: "fr-XX", href: "https://example.com/hreflang-en" }] }),
      at("no-title", { title: null, titleLength: 0 }),
      at("short-title", { title: "Short", titleLength: 5 }),
      at("long-title", { titleLength: TITLE_MAX_LENGTH + 20 }),
      at("no-meta", { metaDescription: null }),
      at("wide-title", { title: "W".repeat(40) }),
      at("same-as-h1", { title: "Heading", h1: "Heading" }),
      at("long-meta", { metaDescriptionLength: META_MAX_LENGTH + 1 }),
      at("short-meta", { metaDescription: "Short", metaDescriptionLength: 5 }),
      at("wide-meta", { metaDescription: "W".repeat(80) }),
      at("long-h1", { h1: "h".repeat(H1_MAX_LENGTH + 1) }),
      at("no-h1", { h1Count: 0 }),
      at("two-h1", { h1Count: 2 }),
      at("thin", { textRatioPct: LOW_TEXT_RATIO_THRESHOLD_PCT - 1 }),
      at("no-alt", { missingAltCount: 2 }),
      at("no-dimensions", { imagesMissingDimensions: 1 }),
      at("nofollow", { internalNofollowCount: 1 }),
      at("unminified", { isMinified: false }),
      at("two-canonicals", { canonicalCount: 2 }),
      at("canonical-to-404", { canonical: "https://example.com/gone" }),
      at("chain", { redirectChain: ["https://example.com/a", "https://example.com/b"] }),
      at("slow", { responseTimeMs: SLOW_RESPONSE_THRESHOLD_MS + 1 }),
      at("no-social", { hasOpenGraph: false, hasTwitterCard: false }),
      at("no-viewport", { viewport: null }),
      at("mobile", { mobileUsabilityViolations: [violation] }),
      at("bad-schema", { structuredDataErrors: ["missing name"] }),
      at("no-schema", { structuredDataTypes: [] }),
      at("a11y", { accessibilityViolations: [{ ...violation, impact: "serious" }] }),
      at("insecure", { insecureLinkCount: 1 }),
      makePage({ url: "http://example.com/plain", canonical: "http://example.com/plain" }),
      at("no-hsts", { hsts: false }),
      at("mixed-content", { mixedContentCount: 1 }),
      at("no-security-headers", {
        contentSecurityPolicy: null,
        xFrameOptions: null,
        xContentTypeOptions: null,
        referrerPolicy: null,
      }),
      at("no-lang", { lang: null }),
      at("Upper-Case"),
      at("snake_case"),
      at("search?q=shoes"),
      at(`long-${"x".repeat(URL_MAX_LENGTH)}`),
      at("caf%C3%A9"),
      at("a//b"),
      at("noindex", { metaRobots: "noindex, follow", indexability: "Non-Indexable (noindex)" }),
      at("meta-nofollow", { metaRobots: "nofollow" }),
      at("robots-none", { metaRobots: "none" }),
      at("x-robots", { xRobotsTag: "googlebot: noarchive" }),
      at("no-canonical", { canonical: null }),
      at("canonicalised", { canonical: "https://example.com/clean", indexability: "Canonicalised" }),
      at("canonical-to-noindex", { canonical: "https://example.com/noindex" }),
      at("moved", { redirectUrl: "https://example.com/clean", indexability: "Redirected" }),
      at("canonical-to-moved", { canonical: "https://example.com/moved" }),
      at("linked-only", { discoveredViaSitemap: false, depth: 1 }),
      at("few-words", { wordCount: LOW_WORD_COUNT - 1 }),
      at("near-dup-a", { contentSimhash: "0123456789abcdef", contentHash: "near-a" }),
      at("near-dup-b", { contentSimhash: "0123456789abcdee", contentHash: "near-b" }),
      at("deep", { depth: DEEP_PAGE_DEPTH + 1 }),
      at("huge", { htmlSizeBytes: LARGE_HTML_BYTES + 1 }),
      at("no-h2", { h2Values: [], h2Count: 0, headingLevels: [1] }),
      at("two-h2", { h2Values: ["One", "Two"], h2Count: 2, headingLevels: [1, 2, 2] }),
      at("long-h2", { h2Values: ["h".repeat(H2_MAX_LENGTH + 1)] }),
      at("skipped-level", { headingLevels: [1, 3] }),
      at("two-titles", { titleCount: 2 }),
      at("two-metas", { metaDescriptionCount: 2 }),
      at("refresh", { metaRefresh: "0; url=/clean" }),
      at("paged", { paginationNext: "https://example.com/gone" }),
      at("linked-redirect", {
        redirectChain: ["https://example.com/linked-redirect"],
        redirectUrl: "https://example.com/clean",
        indexability: "Redirected",
      }),
      at("redirect-to-404", {
        status: 404,
        redirectChain: ["https://example.com/redirect-to-404"],
        redirectUrl: "https://example.com/gone",
      }),
      at("anchors", {
        outlinks: [
          { url: "https://example.com/linked-only", anchor: "Click here", nofollow: false, isImageLink: false },
          { url: "https://example.com/clean", anchor: "", nofollow: false, isImageLink: true },
          { url: "https://example.com/redirect-to-404", anchor: "Old page", nofollow: false, isImageLink: false },
        ],
      }),
    ];
    const resources = [
      makeResource(),
      makeResource({ url: "https://example.com/missing.png", status: 404 }),
      makeResource({ url: "https://example.com/timeout.png", status: null, error: "timeout" }),
      makeResource({ url: "http://example.com/insecure.png", isInsecure: true }),
      makeResource({ url: "https://example.com/large.png", contentLength: LARGE_IMAGE_BYTES + 1 }),
    ];
    const hreflang = getHreflangTracker(pages);
    const ctx: FilterContext = {
      duplicateTitles: getDuplicateTitleSet(pages),
      duplicateContent: getDuplicateContentSet(pages),
      duplicateMeta: getDuplicateMetaSet(pages),
      duplicateH1s: getDuplicateH1Set(pages),
      duplicateH2s: getDuplicateH2Set(pages),
      canonicalStatusMap: getCanonicalStatusMap(pages),
      linkedUrls: new Set(["https://example.com/clean", "https://example.com/linked-redirect"]),
      pageByUrl: getPageByUrlMap(pages),
      sitemapUsed: getSitemapUsed(pages),
      linkGraph: buildLinkGraph(pages),
      non200LinkSources: getNon200LinkSourceSet(pages),
      hreflangMissingReturn: hreflang.missingReturn,
      hreflangTargetError: hreflang.targetError,
      nearDuplicates: nearDuplicateContext(pages),
    };
    return { pages, resources, ctx };
  }

  it("every registry key has a solution", () => {
    for (const def of ISSUE_DEFS) {
      const solution = ISSUE_SOLUTIONS[def.key];
      expect(solution, def.key).toBeDefined();
      expect(solution.title.length, def.key).toBeGreaterThan(0);
    }
  });

  it("every registry key has a unique label", () => {
    const keys = ISSUE_DEFS.map((d) => d.key);
    const labels = ISSUE_DEFS.map((d) => d.label);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("countIssues matches filterPages length for every key", () => {
    const { pages, resources, ctx } = mixedCrawl();
    const counts = countIssues(pages, resources, ctx);
    for (const def of ISSUE_DEFS) {
      const expected =
        def.scope === "page" ? filterPages(pages, def.key, ctx).length : filterResources(resources, def.key, ctx).length;
      expect(counts[def.key], def.key).toBe(expected);
      expect(counts[def.key], `${def.key} is triggered by the mixed crawl`).toBeGreaterThan(0);
    }
    expect(Object.keys(counts).sort()).toEqual(ISSUE_DEFS.map((d) => d.key).sort());
  });

  it("filterTab sends resource-scope issues to the Resources tab and page-scope issues to Pages", () => {
    for (const def of ISSUE_DEFS) {
      expect(filterTab(def.key), def.key).toBe(def.scope === "resource" ? "resources" : "pages");
    }
  });
});

describe("directive and canonical issues", () => {
  const run = (key: FilterKey, overrides: Partial<PageResult>, ctx: FilterContext = emptyFilterContext()) =>
    filterPages([makePage(overrides)], key, ctx).length === 1;

  it("parseRobotsDirectives handles bot prefixes and spacing", () => {
    expect(parseRobotsDirectives(" NoIndex ,  FOLLOW ", null)).toEqual(new Set(["noindex", "follow"]));
    expect(parseRobotsDirectives(null, "googlebot: noindex, nofollow")).toEqual(new Set(["noindex", "nofollow"]));
    expect(parseRobotsDirectives(null, "otherbot:none")).toEqual(new Set(["none"]));
    expect(parseRobotsDirectives("max-snippet: 20, max-image-preview:large", null)).toEqual(
      new Set(["max-snippet:20", "max-image-preview:large"]),
    );
    expect(parseRobotsDirectives("index", "noarchive")).toEqual(new Set(["index", "noarchive"]));
    expect(parseRobotsDirectives(null, null).size).toBe(0);
    expect(parseRobotsDirectives(" , ", "").size).toBe(0);
  });

  it("directiveNoindex flags noindex from meta robots or X-Robots-Tag", () => {
    expect(run("directiveNoindex", { metaRobots: "noindex, follow" })).toBe(true);
    expect(run("directiveNoindex", { xRobotsTag: "googlebot: noindex" })).toBe(true);
    expect(run("directiveNoindex", { metaRobots: "index, follow" })).toBe(false);
    expect(run("directiveNoindex", { metaRobots: "none" })).toBe(false);
  });

  it("directiveNofollow flags a page-level nofollow", () => {
    expect(run("directiveNofollow", { metaRobots: "nofollow" })).toBe(true);
    expect(run("directiveNofollow", { xRobotsTag: "noindex, nofollow" })).toBe(true);
    expect(run("directiveNofollow", { metaRobots: "noindex, follow" })).toBe(false);
  });

  it("directiveNone flags the none directive", () => {
    expect(run("directiveNone", { metaRobots: "NONE" })).toBe(true);
    expect(run("directiveNone", { xRobotsTag: "bingbot: none" })).toBe(true);
    expect(run("directiveNone", { metaRobots: "noindex, nofollow" })).toBe(false);
  });

  it("xRobotsTagPresent flags pages with directives in the X-Robots-Tag header only", () => {
    expect(run("xRobotsTagPresent", { xRobotsTag: "noarchive" })).toBe(true);
    expect(run("xRobotsTagPresent", { xRobotsTag: null, metaRobots: "noindex" })).toBe(false);
    expect(run("xRobotsTagPresent", { xRobotsTag: " " })).toBe(false);
  });

  it("missingCanonical flags 2xx HTML pages without a canonical", () => {
    expect(run("missingCanonical", { canonical: null })).toBe(true);
    expect(run("missingCanonical", { canonical: "https://example.com/" })).toBe(false);
    expect(run("missingCanonical", { canonical: null, status: 404 })).toBe(false);
    expect(run("missingCanonical", { canonical: null, status: 301 })).toBe(false);
    expect(run("missingCanonical", { canonical: null, htmlSizeBytes: 0, contentType: "application/pdf" })).toBe(false);
    expect(run("missingCanonical", { canonical: null, redirectUrl: "https://example.com/new" })).toBe(false);
  });

  it("canonicalised flags pages the crawler classified as canonicalised", () => {
    expect(run("canonicalised", { canonical: "https://example.com/other", indexability: "Canonicalised" })).toBe(true);
    expect(run("canonicalised", { indexability: "Indexable" })).toBe(false);
  });

  it("canonicalToNonIndexable flags a page whose canonical target is noindex", () => {
    // Shaped like the fixture site: /canonical-to-noindex.html -> /noindex.html, / is self-canonical.
    const home = makePage({ url: "https://example.com/", canonical: "https://example.com/" });
    const noindex = makePage({
      url: "https://example.com/noindex.html",
      canonical: null,
      metaRobots: "noindex, follow",
      indexability: "Non-Indexable (noindex)",
    });
    const source = makePage({
      url: "https://example.com/canonical-to-noindex.html",
      canonical: "https://example.com/noindex.html",
      indexability: "Canonicalised",
    });
    const pages = [home, noindex, source];
    const ctx = { ...emptyFilterContext(), pageByUrl: getPageByUrlMap(pages) };
    expect(filterPages(pages, "canonicalToNonIndexable", ctx)).toEqual([source]);
    expect(getPageIssueKeys(source, ctx)).toContain("canonicalToNonIndexable");
    expect(getPageIssueKeys(home, ctx)).not.toContain("canonicalToNonIndexable");
  });

  it("canonicalToNonIndexable is silent for indexable, self-referencing and uncrawled targets", () => {
    const target = makePage({ url: "https://example.com/target", canonical: "https://example.com/target" });
    const ctx = { ...emptyFilterContext(), pageByUrl: getPageByUrlMap([target]) };
    expect(run("canonicalToNonIndexable", { url: "https://example.com/a", canonical: target.url }, ctx)).toBe(false);
    expect(
      run("canonicalToNonIndexable", { url: "https://example.com/b", canonical: "https://example.com/uncrawled" }, ctx),
    ).toBe(false);
    const noindexSelf = makePage({
      url: "https://example.com/self",
      canonical: "https://example.com/self",
      indexability: "Non-Indexable (noindex)",
    });
    const selfCtx = { ...emptyFilterContext(), pageByUrl: getPageByUrlMap([noindexSelf]) };
    expect(filterPages([noindexSelf], "canonicalToNonIndexable", selfCtx)).toEqual([]);
  });

  it("canonicalToRedirect flags a canonical whose target redirects", () => {
    const moved = makePage({
      url: "https://example.com/old-page",
      status: 200,
      redirectUrl: "https://example.com/new-page.html",
      indexability: "Redirected",
    });
    const bare3xx = makePage({ url: "https://example.com/loop", status: 301, redirectUrl: null });
    const live = makePage({ url: "https://example.com/live", canonical: "https://example.com/live" });
    const ctx = { ...emptyFilterContext(), pageByUrl: getPageByUrlMap([moved, bare3xx, live]) };
    const from = (canonical: string) => ({ url: "https://example.com/a", canonical });
    expect(run("canonicalToRedirect", from(moved.url), ctx)).toBe(true);
    expect(run("canonicalToRedirect", from(bare3xx.url), ctx)).toBe(true);
    expect(run("canonicalToRedirect", from(live.url), ctx)).toBe(false);
    expect(run("canonicalToRedirect", from("https://example.com/uncrawled"), ctx)).toBe(false);
  });
});

describe("sitemap issues", () => {
  const sitemapCtx: FilterContext = { ...emptyFilterContext(), sitemapUsed: true };
  const run = (key: FilterKey, overrides: Partial<PageResult>, ctx: FilterContext = sitemapCtx) =>
    filterPages([makePage(overrides)], key, ctx).length === 1;

  it("getSitemapUsed is true only when a page came from the sitemap", () => {
    expect(getSitemapUsed([makePage({ discoveredViaSitemap: false }), makePage({ discoveredViaSitemap: true })])).toBe(true);
    expect(getSitemapUsed([makePage({ discoveredViaSitemap: false })])).toBe(false);
    expect(getSitemapUsed([])).toBe(false);
  });

  it("sitemapNonIndexable flags non-indexable URLs discovered via the sitemap", () => {
    expect(run("sitemapNonIndexable", { discoveredViaSitemap: true, indexability: "Non-Indexable (noindex)" })).toBe(true);
    expect(run("sitemapNonIndexable", { discoveredViaSitemap: true, status: 404, indexability: "Non-Indexable (404)" })).toBe(
      true,
    );
    expect(run("sitemapNonIndexable", { discoveredViaSitemap: true, indexability: "Canonicalised" })).toBe(true);
    expect(run("sitemapNonIndexable", { discoveredViaSitemap: true, indexability: "Indexable" })).toBe(false);
    expect(run("sitemapNonIndexable", { discoveredViaSitemap: false, indexability: "Non-Indexable (noindex)" })).toBe(false);
  });

  it("sitemapNon200 flags sitemap URLs that errored or redirected", () => {
    expect(run("sitemapNon200", { discoveredViaSitemap: true, status: 404 })).toBe(true);
    expect(run("sitemapNon200", { discoveredViaSitemap: true, status: null, error: "timeout" })).toBe(true);
    expect(run("sitemapNon200", { discoveredViaSitemap: true, status: 301 })).toBe(true);
    expect(
      run("sitemapNon200", { discoveredViaSitemap: true, status: 200, redirectUrl: "https://example.com/new" }),
    ).toBe(true);
    expect(run("sitemapNon200", { discoveredViaSitemap: true, status: 200 })).toBe(false);
    expect(run("sitemapNon200", { discoveredViaSitemap: false, status: 404 })).toBe(false);
  });

  it("notInSitemap flags indexable linked pages missing from the sitemap", () => {
    const linked = { discoveredViaSitemap: false, depth: 1, indexability: "Indexable" };
    expect(run("notInSitemap", linked)).toBe(true);
    expect(run("notInSitemap", { ...linked, discoveredViaSitemap: true })).toBe(false);
    expect(run("notInSitemap", { ...linked, indexability: "Non-Indexable (noindex)" })).toBe(false);
    expect(run("notInSitemap", { ...linked, htmlSizeBytes: 0, contentType: "application/pdf" })).toBe(false);
  });

  it("notInSitemap skips the start URL", () => {
    expect(run("notInSitemap", { discoveredViaSitemap: false, depth: 0, indexability: "Indexable" })).toBe(false);
  });

  it("notInSitemap is silent when no page came from a sitemap", () => {
    const pages = [
      makePage({ url: "https://example.com/", depth: 0, discoveredViaSitemap: false }),
      makePage({ url: "https://example.com/a", depth: 1, discoveredViaSitemap: false }),
    ];
    const ctx = { ...emptyFilterContext(), sitemapUsed: getSitemapUsed(pages) };
    expect(filterPages(pages, "notInSitemap", ctx)).toEqual([]);
  });

  it("sitemap issues appear in getPageIssueKeys", () => {
    const page = makePage({ discoveredViaSitemap: true, status: 404, indexability: "Non-Indexable (404)" });
    const keys = getPageIssueKeys(page, sitemapCtx);
    expect(keys).toContain("sitemapNonIndexable");
    expect(keys).toContain("sitemapNon200");
    expect(getPageIssueKeys(makePage({ discoveredViaSitemap: false, depth: 2 }), sitemapCtx)).toContain("notInSitemap");
  });
});

describe("content, depth, size and redirect target issues", () => {
  const run = (key: FilterKey, overrides: Partial<PageResult>, ctx: FilterContext = emptyFilterContext()) =>
    filterPages([makePage(overrides)], key, ctx).length === 1;

  it("lowWordCount flags 2xx HTML pages under the word threshold", () => {
    expect(run("lowWordCount", { wordCount: LOW_WORD_COUNT - 1 })).toBe(true);
    expect(run("lowWordCount", { wordCount: LOW_WORD_COUNT })).toBe(false);
    expect(run("lowWordCount", { wordCount: 0, status: 404 })).toBe(false);
    expect(run("lowWordCount", { wordCount: 0, htmlSizeBytes: 0, contentType: "application/pdf" })).toBe(false);
  });

  it("deepPage flags HTML pages deeper than the depth threshold", () => {
    expect(run("deepPage", { depth: DEEP_PAGE_DEPTH + 1 })).toBe(true);
    expect(run("deepPage", { depth: DEEP_PAGE_DEPTH })).toBe(false);
    expect(run("deepPage", { depth: DEEP_PAGE_DEPTH + 1, htmlSizeBytes: 0 })).toBe(false);
  });

  it("largeHtml flags HTML over 1 MB", () => {
    expect(run("largeHtml", { htmlSizeBytes: LARGE_HTML_BYTES + 1 })).toBe(true);
    expect(run("largeHtml", { htmlSizeBytes: LARGE_HTML_BYTES })).toBe(false);
  });

  it("internalRedirect flags internally linked URLs that redirected", () => {
    const url = "https://example.com/old";
    const linked: FilterContext = { ...emptyFilterContext(), linkedUrls: new Set([url]) };
    const redirected = { url, redirectChain: [url], redirectUrl: "https://example.com/new", indexability: "Redirected" };
    expect(run("internalRedirect", redirected, linked)).toBe(true);
    expect(run("internalRedirect", redirected)).toBe(false);
    expect(run("internalRedirect", { url }, linked)).toBe(false);
  });

  it("redirectToError flags redirects whose final status is not 200", () => {
    const chain = { redirectChain: ["https://example.com/old"], redirectUrl: "https://example.com/gone" };
    expect(run("redirectToError", { ...chain, status: 404 })).toBe(true);
    expect(run("redirectToError", { ...chain, status: 500 })).toBe(true);
    expect(run("redirectToError", { ...chain, status: 301, statusText: "301 (redirect loop or too many hops)" })).toBe(
      true,
    );
    expect(run("redirectToError", { ...chain, status: 200 })).toBe(false);
    expect(run("redirectToError", { status: 404 })).toBe(false);
  });

  it("the new issues appear in getPageIssueKeys", () => {
    const url = "https://example.com/deep";
    const ctx: FilterContext = { ...emptyFilterContext(), linkedUrls: new Set([url]) };
    const page = makePage({
      url,
      depth: DEEP_PAGE_DEPTH + 1,
      wordCount: 10,
      htmlSizeBytes: LARGE_HTML_BYTES + 1,
      redirectChain: [url],
      status: 200,
    });
    const keys = getPageIssueKeys(page, ctx);
    for (const key of ["lowWordCount", "deepPage", "largeHtml", "internalRedirect"] as const) {
      expect(keys).toContain(key);
    }
    expect(keys).not.toContain("redirectToError");
    expect(getPageIssueKeys(makePage({ redirectChain: [url], status: 404 }), ctx)).toContain("redirectToError");
  });
});

describe("heading outline issues", () => {
  const run = (key: FilterKey, overrides: Partial<PageResult>, ctx: FilterContext = emptyFilterContext()) =>
    filterPages([makePage(overrides)], key, ctx).length === 1;

  it("getDuplicateH1Set compares the first H1 and ignores pages without one", () => {
    const pages = [
      makePage({ h1: "Same", h1Values: ["Same"] }),
      makePage({ h1: "Same", h1Values: ["Same", "Other"] }),
      makePage({ h1: "Unique", h1Values: ["Unique", "Other"] }),
      makePage({ h1: null, h1Values: [], h1Count: 0 }),
      makePage({ h1: null, h1Values: [], h1Count: 0 }),
    ];
    expect([...getDuplicateH1Set(pages)]).toEqual(["Same"]);
  });

  it("getDuplicateH2Set compares the first H2 and ignores pages without one", () => {
    const pages = [
      makePage({ h2Values: ["Intro", "A"] }),
      makePage({ h2Values: ["Intro"] }),
      makePage({ h2Values: ["A", "Intro"] }),
      makePage({ h2Values: [] }),
      makePage({ h2Values: [] }),
    ];
    expect([...getDuplicateH2Set(pages)]).toEqual(["Intro"]);
  });

  it("duplicateH1 flags a page whose first H1 is shared, not one with a unique H1", () => {
    const ctx: FilterContext = { ...emptyFilterContext(), duplicateH1s: new Set(["Same"]) };
    expect(run("duplicateH1", { h1: "Same" }, ctx)).toBe(true);
    expect(run("duplicateH1", { h1: "Unique" }, ctx)).toBe(false);
    expect(run("duplicateH1", { h1: null, h1Values: [], h1Count: 0 }, ctx)).toBe(false);
  });

  it("duplicateH2 flags a page whose first H2 is shared, not one with a unique H2", () => {
    const ctx: FilterContext = { ...emptyFilterContext(), duplicateH2s: new Set(["Intro"]) };
    expect(run("duplicateH2", { h2Values: ["Intro"] }, ctx)).toBe(true);
    expect(run("duplicateH2", { h2Values: ["Specific", "Intro"] }, ctx)).toBe(false);
    expect(run("duplicateH2", { h2Values: [], h2Count: 0 }, ctx)).toBe(false);
  });

  it("missingH2 flags a 2xx HTML page with no H2", () => {
    expect(run("missingH2", { h2Values: [], h2Count: 0, headingLevels: [1, 3] })).toBe(true);
    expect(run("missingH2", { h2Values: [], h2Count: 0, headingLevels: [], h1: null, h1Values: [], h1Count: 0 })).toBe(
      true,
    );
    expect(run("missingH2", {})).toBe(false);
  });

  it("missingH2 ignores non-HTML, non-2xx and pre-heading-outline pages", () => {
    const noH2 = { h2Values: [], h2Count: 0, headingLevels: [] };
    expect(run("missingH2", { ...noH2, h1: null, h1Count: 0, htmlSizeBytes: 0 })).toBe(false);
    expect(run("missingH2", { ...noH2, h1: null, h1Count: 0, status: 404 })).toBe(false);
    // A crawl saved before heading levels existed: an H1 was seen but no levels recorded.
    expect(run("missingH2", { ...noH2, h1Count: 1 })).toBe(false);
  });

  it("multipleH2 flags more than one H2, not exactly one", () => {
    expect(run("multipleH2", { h2Count: 2 })).toBe(true);
    expect(run("multipleH2", { h2Count: 1 })).toBe(false);
    expect(run("multipleH2", { h2Count: 0 })).toBe(false);
  });

  it("h2TooLong flags any H2 one character over the limit, not at it", () => {
    expect(run("h2TooLong", { h2Values: ["Short", "h".repeat(H2_MAX_LENGTH + 1)] })).toBe(true);
    expect(run("h2TooLong", { h2Values: ["h".repeat(H2_MAX_LENGTH)] })).toBe(false);
    expect(run("h2TooLong", { h2Values: [`  ${"h".repeat(H2_MAX_LENGTH)}  `] })).toBe(false);
    expect(run("h2TooLong", { h2Values: [] })).toBe(false);
  });

  it("h1TooLong checks every H1, not only the first", () => {
    expect(run("h1TooLong", { h1: "Short", h1Values: ["Short", "h".repeat(H1_MAX_LENGTH + 1)] })).toBe(true);
    expect(run("h1TooLong", { h1: "Short", h1Values: ["Short", "h".repeat(H1_MAX_LENGTH)] })).toBe(false);
  });

  it("hasHeadingLevelSkip flags an increase of more than one level only", () => {
    expect(hasHeadingLevelSkip([1, 3])).toBe(true);
    expect(hasHeadingLevelSkip([1, 2, 4])).toBe(true);
    expect(hasHeadingLevelSkip([1, 2, 3, 2, 3, 1, 2])).toBe(false);
    // Stepping back up any number of levels is fine.
    expect(hasHeadingLevelSkip([1, 2, 3, 4, 1])).toBe(false);
    expect(hasHeadingLevelSkip([])).toBe(false);
    expect(hasHeadingLevelSkip([3])).toBe(false);
  });

  it("nonSequentialHeadings flags H1 then H3, not H1 then H2", () => {
    expect(run("nonSequentialHeadings", { headingLevels: [1, 3] })).toBe(true);
    expect(run("nonSequentialHeadings", { headingLevels: [1, 2, 3] })).toBe(false);
  });

  it("the new issues appear in getPageIssueKeys", () => {
    const ctx: FilterContext = {
      ...emptyFilterContext(),
      duplicateH1s: new Set(["Heading"]),
      duplicateH2s: new Set(["Subheading"]),
    };
    const keys = getPageIssueKeys(makePage({ headingLevels: [1, 2, 4, 2], h2Count: 2 }), ctx);
    for (const key of ["duplicateH1", "multipleH2", "duplicateH2", "nonSequentialHeadings"] as const) {
      expect(keys).toContain(key);
    }
    const missing = getPageIssueKeys(
      makePage({ h2Values: ["h".repeat(H2_MAX_LENGTH + 1)], h2Count: 0, headingLevels: [1] }),
      emptyFilterContext(),
    );
    expect(missing).toEqual(expect.arrayContaining(["missingH2", "h2TooLong"]));
  });
});

describe("multiple titles, meta descriptions, meta refresh and pagination issues", () => {
  const run = (key: FilterKey, overrides: Partial<PageResult>, ctx: FilterContext = emptyFilterContext()) =>
    filterPages([makePage(overrides)], key, ctx).length === 1;

  it("multipleTitles flags two or more title elements, not one or none", () => {
    expect(run("multipleTitles", { titleCount: 2 })).toBe(true);
    expect(run("multipleTitles", { titleCount: 1 })).toBe(false);
    // A crawl saved before T2.2 has no count at all.
    expect(run("multipleTitles", { titleCount: 0 })).toBe(false);
  });

  it("multipleMetaDescriptions flags two or more description tags, not one or none", () => {
    expect(run("multipleMetaDescriptions", { metaDescriptionCount: 2 })).toBe(true);
    expect(run("multipleMetaDescriptions", { metaDescriptionCount: 1 })).toBe(false);
    expect(run("multipleMetaDescriptions", { metaDescriptionCount: 0, metaDescription: null })).toBe(false);
  });

  it("metaRefresh flags any meta refresh content, not its absence", () => {
    expect(run("metaRefresh", { metaRefresh: "0; url=https://example.com/new" })).toBe(true);
    expect(run("metaRefresh", { metaRefresh: "30" })).toBe(true);
    expect(run("metaRefresh", { metaRefresh: null })).toBe(false);
    expect(run("metaRefresh", { metaRefresh: "" })).toBe(false);
  });

  describe("paginationTargetError", () => {
    const at = (path: string, overrides: Partial<PageResult> = {}) =>
      makePage({ url: `https://example.com/${path}`, ...overrides });
    const ok = at("page-2");
    const gone = at("page-404", { status: 404 });
    const moved = at("page-moved", { redirectChain: ["https://example.com/page-moved"] });
    const ctx: FilterContext = { ...emptyFilterContext(), pageByUrl: getPageByUrlMap([ok, gone, moved]) };

    it("flags a rel=next or rel=prev target that is non-200, redirected or not crawled", () => {
      expect(run("paginationTargetError", { paginationNext: gone.url }, ctx)).toBe(true);
      expect(run("paginationTargetError", { paginationPrev: gone.url }, ctx)).toBe(true);
      expect(run("paginationTargetError", { paginationNext: moved.url }, ctx)).toBe(true);
      expect(run("paginationTargetError", { paginationNext: "https://example.com/never-crawled" }, ctx)).toBe(true);
      expect(run("paginationTargetError", { paginationNext: ok.url, paginationPrev: gone.url }, ctx)).toBe(true);
    });

    it("does not flag crawled 200 targets or pages without pagination", () => {
      expect(run("paginationTargetError", { paginationNext: ok.url, paginationPrev: ok.url }, ctx)).toBe(false);
      expect(run("paginationTargetError", { paginationNext: null, paginationPrev: null }, ctx)).toBe(false);
    });
  });

  it("the new issues appear in getPageIssueKeys", () => {
    const keys = getPageIssueKeys(
      makePage({
        titleCount: 2,
        metaDescriptionCount: 3,
        metaRefresh: "5",
        paginationNext: "https://example.com/missing",
      }),
      emptyFilterContext(),
    );
    expect(keys).toEqual(
      expect.arrayContaining(["multipleTitles", "multipleMetaDescriptions", "metaRefresh", "paginationTargetError"]),
    );
    const clean = getPageIssueKeys(makePage(), emptyFilterContext());
    for (const key of ["multipleTitles", "multipleMetaDescriptions", "metaRefresh", "paginationTargetError"] as const) {
      expect(clean).not.toContain(key);
    }
  });
});

describe("link analysis issues", () => {
  const link = (url: string, overrides: Partial<LinkRef> = {}): LinkRef => ({
    url,
    anchor: "Pricing guide",
    nofollow: false,
    isImageLink: false,
    ...overrides,
  });
  const run = (key: FilterKey, overrides: Partial<PageResult>, ctx: FilterContext = emptyFilterContext()) =>
    filterPages([makePage(overrides)], key, ctx).length === 1;

  it("isNonDescriptiveAnchor matches the list after trimming punctuation and case", () => {
    for (const anchor of NON_DESCRIPTIVE_ANCHORS) expect(isNonDescriptiveAnchor(anchor), anchor).toBe(true);
    expect(isNonDescriptiveAnchor("Read more...")).toBe(true);
    expect(isNonDescriptiveAnchor("  Click   HERE! ")).toBe(true);
    expect(isNonDescriptiveAnchor("→ Learn more")).toBe(true);
    expect(isNonDescriptiveAnchor("Read more about pricing")).toBe(false);
    expect(isNonDescriptiveAnchor("Heretic")).toBe(false);
    expect(isNonDescriptiveAnchor("")).toBe(false);
  });

  it("nonDescriptiveAnchors flags a generic anchor, not a descriptive one", () => {
    expect(run("nonDescriptiveAnchors", { outlinks: [link("https://example.com/a", { anchor: "Read more" })] })).toBe(
      true,
    );
    expect(run("nonDescriptiveAnchors", { outlinks: [link("https://example.com/a")] })).toBe(false);
    expect(run("nonDescriptiveAnchors", { outlinks: [] })).toBe(false);
  });

  it("emptyAnchors flags an empty text link or an image link without alt", () => {
    expect(run("emptyAnchors", { outlinks: [link("https://example.com/a", { anchor: "" })] })).toBe(true);
    expect(
      run("emptyAnchors", { outlinks: [link("https://example.com/a", { anchor: " ", isImageLink: true })] }),
    ).toBe(true);
    expect(
      run("emptyAnchors", { outlinks: [link("https://example.com/a", { anchor: "Logo", isImageLink: true })] }),
    ).toBe(false);
  });

  describe("singleInlink", () => {
    const target = "https://example.com/target";
    const ctxWith = (...sources: string[]): FilterContext => ({
      ...emptyFilterContext(),
      linkGraph: buildLinkGraph(sources.map((s) => makePage({ url: s, outlinks: [link(target), link(target)] }))),
    });

    it("flags a page linked from exactly one other page", () => {
      expect(run("singleInlink", { url: target, depth: 1 }, ctxWith("https://example.com/"))).toBe(true);
    });

    it("does not flag two linking pages, no inlinks, the start page or a non-200 page", () => {
      const one = ctxWith("https://example.com/");
      expect(run("singleInlink", { url: target, depth: 1 }, ctxWith("https://example.com/", "https://example.com/b"))).toBe(
        false,
      );
      expect(run("singleInlink", { url: target, depth: 1 }, emptyFilterContext())).toBe(false);
      expect(run("singleInlink", { url: target, depth: 0 }, one)).toBe(false);
      expect(run("singleInlink", { url: target, depth: 1, status: 404 }, one)).toBe(false);
    });
  });

  describe("linksToErrorPages", () => {
    const at = (path: string, overrides: Partial<PageResult> = {}) =>
      makePage({ url: `https://example.com/${path}`, ...overrides });
    const ok = at("ok");
    const gone = at("gone", { status: 404 });
    const moved = at("moved", { redirectChain: ["https://example.com/moved"], redirectUrl: ok.url });
    const failed = at("failed", { status: null, error: "timeout" });
    const blocked = at("blocked", {
      status: null,
      statusText: "Blocked",
      indexability: "Non-Indexable (robots.txt)",
      htmlSizeBytes: 0,
    });
    const targets = [ok, gone, moved, failed, blocked];
    /** Whether a source page with these outlinks is flagged, crawled after (or before) the targets. */
    const flagged = (outlinks: LinkRef[], sourceFirst = false) => {
      const source = at("source", { outlinks });
      const pages = sourceFirst ? [source, ...targets] : [...targets, source];
      const ctx: FilterContext = { ...emptyFilterContext(), non200LinkSources: getNon200LinkSourceSet(pages) };
      return filterPages(pages, "linksToErrorPages", ctx).includes(source);
    };

    it("flags links to a crawled 4xx, redirected or failed page", () => {
      expect(flagged([link(ok.url), link(gone.url)])).toBe(true);
      expect(flagged([link(moved.url)])).toBe(true);
      expect(flagged([link(failed.url)])).toBe(true);
    });

    it("flags the source whichever of source and target is crawled first", () => {
      expect(flagged([link(gone.url)], true)).toBe(true);
      expect(flagged([link(ok.url)], true)).toBe(false);
    });

    it("builds the same set incrementally as in one pass", () => {
      const pages = [at("a", { outlinks: [link(gone.url)] }), gone, ok, at("b", { outlinks: [link(moved.url)] }), moved];
      const graph = createLinkGraph();
      const pageByUrl = new Map<string, PageResult>();
      const sources = new Set<string>();
      for (const page of pages) {
        addPageToLinkGraph(graph, page);
        pageByUrl.set(page.url, page);
        ingestNon200LinkSources(sources, graph, pageByUrl, page);
      }
      expect(sources).toEqual(getNon200LinkSourceSet(pages));
      expect([...sources].sort()).toEqual(["https://example.com/a", "https://example.com/b"]);
    });

    it("does not flag links to 200 pages, robots-blocked pages or URLs the crawl never reached", () => {
      expect(isNon200LinkTarget(blocked)).toBe(false);
      expect(flagged([link(ok.url)])).toBe(false);
      expect(flagged([link(blocked.url)])).toBe(false);
      expect(flagged([link(blocked.url)], true)).toBe(false);
      expect(flagged([link("https://example.com/not-crawled")])).toBe(false);
    });
  });

  it("the new issues appear in getPageIssueKeys", () => {
    const target = makePage({ url: "https://example.com/gone", status: 404 });
    const source = makePage({
      url: "https://example.com/source",
      outlinks: [link(target.url, { anchor: "here" }), link("https://example.com/single", { anchor: "" })],
    });
    const single = makePage({ url: "https://example.com/single", depth: 2 });
    const ctx: FilterContext = {
      ...emptyFilterContext(),
      linkGraph: buildLinkGraph([target, source, single]),
      non200LinkSources: getNon200LinkSourceSet([target, source, single]),
    };
    expect(getPageIssueKeys(source, ctx)).toEqual(
      expect.arrayContaining(["nonDescriptiveAnchors", "emptyAnchors", "linksToErrorPages"]),
    );
    expect(getPageIssueKeys(single, ctx)).toContain("singleInlink");
    const clean = getPageIssueKeys(makePage(), ctx);
    for (const key of ["nonDescriptiveAnchors", "emptyAnchors", "singleInlink", "linksToErrorPages"] as const) {
      expect(clean).not.toContain(key);
    }
  });
});

describe("hreflang issues", () => {
  const url = (path: string) => `https://example.com/${path}`;
  const link = (lang: string, path: string) => ({ lang, href: url(path) });
  const page = (path: string, overrides: Partial<PageResult> = {}) => makePage({ url: url(path), ...overrides });
  const ctxFor = (pages: PageResult[]): FilterContext => {
    const tracker = getHreflangTracker(pages);
    return {
      ...emptyFilterContext(),
      hreflangMissingReturn: tracker.missingReturn,
      hreflangTargetError: tracker.targetError,
    };
  };
  const flagged = (pages: PageResult[], key: FilterKey) => filterPages(pages, key, ctxFor(pages)).map((p) => p.url);

  it("hreflangMissingReturn flags a page whose crawled target does not annotate it back", () => {
    const en = page("en", { hreflangLinks: [link("en", "en"), link("fr", "fr")] });
    const fr = page("fr", { hreflangLinks: [link("fr", "fr")] });
    expect(flagged([en, fr], "hreflangMissingReturn")).toEqual([url("en")]);

    const frBack = page("fr", { hreflangLinks: [link("fr", "fr"), link("en", "en")] });
    expect(flagged([en, frBack], "hreflangMissingReturn")).toEqual([]);
  });

  it("hreflangMissingReturn only checks targets that were crawled", () => {
    const en = page("en", { hreflangLinks: [link("en", "en"), { lang: "fr", href: "https://example.fr/" }] });
    expect(flagged([en], "hreflangMissingReturn")).toEqual([]);
  });

  it("skips a redirected page as a hreflang source", () => {
    // Stored under the requested URL, while its hrefs resolve against the page it landed on.
    const redirected = page("old-en", {
      redirectChain: [url("old-en")],
      hreflangLinks: [link("en", "en"), link("fr", "fr")],
    });
    const fr = page("fr", { hreflangLinks: [link("fr", "fr")] });
    for (const key of [
      "hreflangMissingSelf",
      "hreflangMissingReturn",
      "hreflangMissingXDefault",
      "hreflangTargetError",
    ] as const) {
      expect(flagged([redirected, fr], key), key).not.toContain(url("old-en"));
    }
  });

  it("does not park off-host hreflang targets", () => {
    const tracker = createHreflangTracker();
    const en = page("en", { hreflangLinks: [link("en", "en"), { lang: "fr", href: "https://example.fr/" }, link("de", "de")] });
    ingestHreflangPage(tracker, new Map([[en.url, en]]), en);
    expect([...tracker.waiting.keys()]).toEqual([url("de")]);
  });

  it("the hreflang tracker gives the same result whichever page arrives first", () => {
    const en = page("en", { hreflangLinks: [link("en", "en"), link("fr", "fr"), link("de", "de")] });
    const fr = page("fr", { hreflangLinks: [link("fr", "fr")] });
    const de = page("de", { status: 404 });
    for (const order of [
      [en, fr, de],
      [fr, de, en],
      [de, en, fr],
    ]) {
      const tracker = createHreflangTracker();
      const pageByUrl = new Map<string, PageResult>();
      for (const p of order) {
        pageByUrl.set(p.url, p);
        ingestHreflangPage(tracker, pageByUrl, p);
      }
      expect([...tracker.missingReturn]).toEqual([url("en")]);
      expect([...tracker.targetError]).toEqual([url("en")]);
      expect(tracker.waiting.size).toBe(0);
    }
  });

  it("hreflangMissingSelf flags a set that does not include the page itself", () => {
    expect(flagged([page("en", { hreflangLinks: [link("fr", "fr")] })], "hreflangMissingSelf")).toEqual([url("en")]);
    expect(flagged([page("en", { hreflangLinks: [link("en", "en"), link("fr", "fr")] })], "hreflangMissingSelf")).toEqual([]);
    expect(flagged([page("en")], "hreflangMissingSelf")).toEqual([]);
  });

  it("hreflangMissingXDefault flags a set without x-default in any case", () => {
    expect(flagged([page("en", { hreflangLinks: [link("en", "en")] })], "hreflangMissingXDefault")).toEqual([url("en")]);
    expect(
      flagged([page("en", { hreflangLinks: [link("en", "en"), link("X-Default", "")] })], "hreflangMissingXDefault"),
    ).toEqual([]);
    // Crawls saved before hreflang links were collected have only hreflangValues.
    expect(flagged([page("en", { hreflangValues: ["en"] })], "hreflangMissingXDefault")).toEqual([]);
  });

  it("hreflangInvalidCode flags any unknown language or region code", () => {
    expect(flagged([page("en", { hreflangLinks: [link("en", "en"), link("fr-XX", "fr")] })], "hreflangInvalidCode")).toEqual([
      url("en"),
    ]);
    expect(flagged([page("en", { hreflangLinks: [link("en-GB", "en"), link("x-default", "")] })], "hreflangInvalidCode")).toEqual(
      [],
    );
  });

  it("hreflangTargetError flags non-200, redirected and non-indexable targets but not robots-blocked ones", () => {
    const source = (target: string) => page("en", { hreflangLinks: [link("en", "en"), link("xx", target)] });
    const cases: [PageResult, boolean][] = [
      [page("t", { status: 404 }), true],
      [page("t", { redirectChain: [url("t")] }), true],
      [page("t", { indexability: "Non-Indexable (noindex)" }), true],
      [page("t", { status: null, error: null, indexability: "Non-Indexable (robots.txt)", htmlSizeBytes: 0 }), false],
      [page("t", { hreflangLinks: [link("en", "en")] }), false],
    ];
    for (const [target, expected] of cases) {
      expect(flagged([source("t"), target], "hreflangTargetError"), JSON.stringify(target.indexability)).toEqual(
        expected ? [url("en")] : [],
      );
    }
  });

  it("reports the hreflang keys in getPageIssueKeys", () => {
    const en = page("en", { hreflangLinks: [link("en-XX", "fr"), link("fr", "fr")] });
    const fr = page("fr", { status: 500 });
    const keys = getPageIssueKeys(en, ctxFor([en, fr]));
    expect(keys).toEqual(
      expect.arrayContaining(["hreflangMissingSelf", "hreflangMissingXDefault", "hreflangInvalidCode", "hreflangTargetError"]),
    );
    expect(keys).not.toContain("hreflangMissingReturn");
  });
});

describe("near-duplicate content", () => {
  const url = (path: string) => `https://example.com/${path}`;
  const page = (path: string, overrides: Partial<PageResult> = {}) =>
    makePage({ url: url(path), contentHash: `hash-${path}`, ...overrides });
  const flagged = (pages: PageResult[]) =>
    filterPages(pages, "nearDuplicateContent", { ...emptyFilterContext(), nearDuplicates: nearDuplicateContext(pages) }).map(
      (p) => p.url,
    );

  it("flags pages whose simhashes are within 3 bits", () => {
    const pages = [
      page("a", { contentSimhash: "ffff0000ffff0000" }),
      page("b", { contentSimhash: "ffff0000ffff0007" }),
      page("far", { contentSimhash: "ffff0000ffff00f0" }),
    ];
    expect(flagged(pages)).toEqual([url("a"), url("b")]);
  });

  it("does not flag exact duplicates, which are duplicateContent", () => {
    const pages = [
      page("a", { contentSimhash: "ffff0000ffff0000", contentHash: "same" }),
      page("b", { contentSimhash: "ffff0000ffff0000", contentHash: "same" }),
    ];
    expect(flagged(pages)).toEqual([]);
  });

  it("does not flag pages from crawls saved without simhashes", () => {
    expect(flagged([page("a", { contentSimhash: "" }), page("b", { contentSimhash: "" })])).toEqual([]);
  });

  it("does not flag redirected, non-200, non-HTML or non-indexable copies", () => {
    const original = page("a", { contentSimhash: "ffff0000ffff0000" });
    for (const copy of [
      page("r", { contentSimhash: "ffff0000ffff0001", redirectChain: [url("r")] }),
      page("e", { contentSimhash: "ffff0000ffff0001", status: 500 }),
      page("n", { contentSimhash: "ffff0000ffff0001", htmlSizeBytes: 0 }),
      page("c", { contentSimhash: "ffff0000ffff0001", indexability: "Canonicalised" }),
    ]) {
      expect(flagged([original, copy]), copy.url).toEqual([]);
    }
  });

  it("appears in getPageIssueKeys", () => {
    const pages = [page("a", { contentSimhash: "ffff0000ffff0000" }), page("b", { contentSimhash: "ffff0000ffff0001" })];
    const ctx = { ...emptyFilterContext(), nearDuplicates: nearDuplicateContext(pages) };
    expect(getPageIssueKeys(pages[0], ctx)).toContain("nearDuplicateContent");
    expect(getPageIssueKeys(makePage(), ctx)).not.toContain("nearDuplicateContent");
  });
});
