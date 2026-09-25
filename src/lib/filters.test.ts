import { describe, expect, it } from "vitest";
import type { PageResult, ResourceResult } from "../types";
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
  LOW_WORD_COUNT,
  LOW_TEXT_RATIO_THRESHOLD_PCT,
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
  getPageByUrlMap,
  getPageIssueKeys,
  getResourceIssueKeys,
  getSitemapUsed,
  getTitlePixelWidth,
  hasHeadingLevelSkip,
  ingestDuplicateValue,
  parseRobotsDirectives,
  searchPages,
  searchResources,
} from "./filters";

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
    insecureLinkCount: 0,
    missingAltCount: 0,
    lang: "en",
    hreflangValues: [],
    internalNofollowCount: 0,
    textRatioPct: 20,
    contentHash: "hash1",
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
      at("deep", { depth: DEEP_PAGE_DEPTH + 1 }),
      at("huge", { htmlSizeBytes: LARGE_HTML_BYTES + 1 }),
      at("no-h2", { h2Values: [], h2Count: 0, headingLevels: [1] }),
      at("two-h2", { h2Values: ["One", "Two"], h2Count: 2, headingLevels: [1, 2, 2] }),
      at("long-h2", { h2Values: ["h".repeat(H2_MAX_LENGTH + 1)] }),
      at("skipped-level", { headingLevels: [1, 3] }),
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
    ];
    const resources = [
      makeResource(),
      makeResource({ url: "https://example.com/missing.png", status: 404 }),
      makeResource({ url: "https://example.com/timeout.png", status: null, error: "timeout" }),
      makeResource({ url: "http://example.com/insecure.png", isInsecure: true }),
    ];
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
