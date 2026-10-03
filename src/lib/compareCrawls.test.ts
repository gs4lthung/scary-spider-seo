import { describe, expect, it } from "vitest";
import type { PageResult, ResourceResult } from "../types";
import {
  COMPARED_FIELD_LABELS,
  buildCrawlFilterContext,
  changedFieldRows,
  comparisonUrl,
  compareCrawls,
  incomparableIssueKeys,
} from "./compareCrawls";
import { type IssueKey, countIssues } from "./filters";

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

function crawl(pages: PageResult[], resources: ResourceResult[] = []) {
  return { pages, resources };
}

describe("compareCrawls", () => {
  it("detects added and removed urls", () => {
    const before = crawl([makePage({ url: "https://example.com/" }), makePage({ url: "https://example.com/old" })]);
    const after = crawl([makePage({ url: "https://example.com/" }), makePage({ url: "https://example.com/new" })]);
    const result = compareCrawls(before, after);
    expect(result.added.map((r) => r.url)).toEqual(["https://example.com/new"]);
    expect(result.removed.map((r) => r.url)).toEqual(["https://example.com/old"]);
    expect(result.changed).toEqual([]);
  });

  it("keeps the trailing slash and drops the fragment when matching urls", () => {
    const before = crawl([makePage({ url: "https://example.com/a" }), makePage({ url: "https://example.com/b#top" })]);
    const after = crawl([makePage({ url: "https://example.com/a/" }), makePage({ url: "https://example.com/b" })]);
    const result = compareCrawls(before, after);
    expect(result.added.map((r) => r.url)).toEqual(["https://example.com/a/"]);
    expect(result.removed.map((r) => r.url)).toEqual(["https://example.com/a"]);
    expect(comparisonUrl("https://example.com/b#top")).toBe("https://example.com/b");
  });

  it("reports field changes", () => {
    const url = "https://example.com/page";
    const before = crawl([makePage({ url, title: "Old title", status: 200, canonical: url })]);
    const after = crawl([
      makePage({
        url,
        title: "New title",
        status: 404,
        indexability: "Non-Indexable",
        metaDescription: "Different",
        h1: "Other",
        canonical: "https://example.com/other",
      }),
    ]);
    const [change] = compareCrawls(before, after).changed;
    expect(change.url).toBe(url);
    expect(change.fields.map((f) => f.name)).toEqual([
      "status",
      "indexability",
      "title",
      "metaDescription",
      "h1",
      "canonical",
    ]);
    expect(change.fields.find((f) => f.name === "title")).toEqual({ name: "title", before: "Old title", after: "New title" });
    for (const f of change.fields) expect(COMPARED_FIELD_LABELS[f.name]).toBeTruthy();
  });

  it("ignores word count changes under 20 percent", () => {
    const before = crawl([
      makePage({ url: "https://example.com/a", wordCount: 500 }),
      makePage({ url: "https://example.com/b", wordCount: 500 }),
      makePage({ url: "https://example.com/c", wordCount: 500 }),
      makePage({ url: "https://example.com/d", wordCount: 0 }),
    ]);
    const after = crawl([
      makePage({ url: "https://example.com/a", wordCount: 590 }),
      makePage({ url: "https://example.com/b", wordCount: 600 }),
      makePage({ url: "https://example.com/c", wordCount: 399 }),
      makePage({ url: "https://example.com/d", wordCount: 10 }),
    ]);
    const changed = compareCrawls(before, after).changed;
    expect(changed.map((c) => c.url)).toEqual(["https://example.com/c", "https://example.com/d"]);
    expect(changed[0].fields).toEqual([{ name: "wordCount", before: 500, after: 399 }]);
  });

  it("treats empty and missing text as the same value", () => {
    const before = crawl([makePage({ title: "", canonical: null })]);
    const legacyPage = { ...makePage({ title: null }) } as Partial<PageResult>;
    delete legacyPage.canonical;
    const after = crawl([legacyPage as PageResult]);
    expect(compareCrawls(before, after).changed).toEqual([]);
  });

  it("maps hosts before comparing", () => {
    const before = crawl([
      makePage({ url: "https://staging.example.com/", canonical: "https://staging.example.com/" }),
      makePage({ url: "https://staging.example.com/only-staging" }),
    ]);
    const after = crawl([makePage({ url: "https://example.com/", canonical: "https://example.com/" })]);
    const unmapped = compareCrawls(before, after);
    expect(unmapped.added).toHaveLength(1);
    expect(unmapped.removed).toHaveLength(2);

    const mapped = compareCrawls(before, after, {
      mapHostFrom: "https://Staging.example.com/",
      mapHostTo: "example.com",
    });
    expect(mapped.added).toEqual([]);
    expect(mapped.removed.map((r) => r.url)).toEqual(["https://example.com/only-staging"]);
    expect(mapped.changed).toEqual([]);
  });

  it("issue deltas match countIssues", () => {
    const beforePages = [
      makePage({ url: "https://example.com/", title: null }),
      makePage({ url: "https://example.com/a", title: "Same" }),
      makePage({ url: "https://example.com/b", title: "Same" }),
    ];
    const afterPages = [makePage({ url: "https://example.com/", status: 404 })];
    const beforeResources = [makeResource({ status: 404, statusText: "Not Found" })];
    const before = crawl(beforePages, beforeResources);
    const after = crawl(afterPages);
    const expectedBefore = countIssues(beforePages, beforeResources, buildCrawlFilterContext(beforePages));
    const expectedAfter = countIssues(afterPages, [], buildCrawlFilterContext(afterPages));
    const { issueDeltas } = compareCrawls(before, after);
    expect(issueDeltas.map((d) => d.key)).toEqual(Object.keys(expectedBefore));
    for (const delta of issueDeltas) {
      expect(delta.before).toBe(expectedBefore[delta.key]);
      expect(delta.after).toBe(expectedAfter[delta.key]);
    }
    expect(issueDeltas.find((d) => d.key === "missingTitle")).toMatchObject({ before: 1, after: 0 });
  });

  it("builds the filter context the live crawl would", () => {
    const pages = [
      makePage({ url: "https://example.com/", outlinks: [{ url: "https://example.com/a", anchor: "A", nofollow: false, isImageLink: false }] }),
      makePage({ url: "https://example.com/a", title: "Same" }),
      makePage({ url: "https://example.com/b", title: "Same" }),
    ];
    const ctx = buildCrawlFilterContext(pages);
    expect(ctx.duplicateTitles).toEqual(new Set(["Same"]));
    expect(ctx.linkedUrls).toEqual(new Set(["https://example.com/a"]));
    expect(ctx.pageByUrl.size).toBe(3);
    expect(ctx.listMode).toBe(false);
  });

  it("flattens changes to one row per field", () => {
    const rows = changedFieldRows([
      { url: "https://example.com/a", fields: [{ name: "status", before: 200, after: 404 }, { name: "h1", before: "A", after: null }] },
    ]);
    expect(rows).toEqual([
      { url: "https://example.com/a", field: "Status", before: 200, after: 404 },
      { url: "https://example.com/a", field: "H1", before: "A", after: null },
    ]);
  });

  it("marks issues built on signals a legacy crawl lacks as not comparable", () => {
    const link = (url: string) => ({ url, anchor: "Read more", nofollow: false, isImageLink: false });
    // Shaped like a crawl saved before T2.1/T2.3: no outlinks or heading outline recorded,
    // so every sitemap page would look orphaned and H2 data would look absent.
    const legacyPage = (url: string) =>
      makePage({
        url,
        discoveredViaSitemap: true,
        internalLinkCount: 2,
        outlinks: [],
        headingLevels: [],
        h2Values: [],
        h2Count: 0,
      });
    const legacy = crawl([legacyPage("https://example.com/"), legacyPage("https://example.com/a")]);
    const current = crawl([
      makePage({ url: "https://example.com/", outlinks: [link("https://example.com/a")] }),
      makePage({ url: "https://example.com/a", outlinks: [link("https://example.com/")] }),
    ]);
    const { issueDeltas } = compareCrawls(legacy, current);
    const delta = (key: string) => issueDeltas.find((d) => d.key === key);
    expect(delta("orphanPage")?.comparable).toBe(false);
    expect(delta("missingH2")?.comparable).toBe(false);
    expect(delta("nonDescriptiveAnchors")?.comparable).toBe(false);
    // Signals both crawls carry stay comparable.
    expect(delta("missingTitle")?.comparable).toBe(true);
    const reported = issueDeltas.filter((d) => d.comparable && d.before !== d.after).map((d) => d.key);
    expect(reported).not.toContain("orphanPage");
    expect(reported).not.toContain("missingH2");
  });

  it("keeps every issue comparable between two current crawls", () => {
    const pages = [
      makePage({
        url: "https://example.com/",
        outlinks: [{ url: "https://example.com/a", anchor: "A page", nofollow: false, isImageLink: false }],
        contentSimhash: "0123456789abcdef",
        titleCount: 1,
        imagesMissingDimensions: 1,
      }),
    ];
    expect(incomparableIssueKeys(crawl(pages), crawl(pages)).size).toBe(0);
  });

  it("marks js comparison issues n/a when a crawl rendered pages without raw HTML", () => {
    const raw = {
      title: "Raw",
      metaDescription: null,
      h1: null,
      canonical: null,
      metaRobots: null,
      wordCount: 1,
      internalLinkCount: 0,
    };
    const compared = crawl([makePage({ url: "https://example.com/", rendered: true, raw })]);
    const renderedOnly = crawl([makePage({ url: "https://example.com/", rendered: true })]);
    const notRendered = crawl([makePage({ url: "https://example.com/" })]);
    const jsKeys: IssueKey[] = ["jsChangesTitle", "jsChangesCanonical", "jsChangesRobots", "jsAddsMostContent", "jsAddsLinks"];
    const incomparableJs = (a: typeof compared, b: typeof compared) =>
      jsKeys.filter((k) => incomparableIssueKeys(a, b).has(k));
    expect(incomparableJs(compared, renderedOnly)).toEqual(jsKeys);
    // No page rendered: nothing could have been compared, so zero is a real count.
    expect(incomparableJs(compared, notRendered)).toEqual([]);
    expect(incomparableJs(compared, compared)).toEqual([]);
  });

  it("counts url collisions and keeps the first page", () => {
    const before = crawl([
      makePage({ url: "https://staging.example.com/", title: "First" }),
      makePage({ url: "https://example.com/", title: "Second" }),
    ]);
    const after = crawl([makePage({ url: "https://example.com/", title: "First" })]);
    const result = compareCrawls(before, after, { mapHostFrom: "staging.example.com", mapHostTo: "example.com" });
    expect(result.collisions).toEqual({ before: 1, after: 0 });
    expect(result.changed).toEqual([]);
  });
});
