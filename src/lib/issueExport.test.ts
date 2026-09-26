import { describe, expect, it } from "vitest";
import type { PageResult, ResourceResult } from "../types";
import { ISSUE_DEFS, countIssues, emptyFilterContext, getDuplicateTitleSet } from "./filters";
import { buildIssueSummaryCsv, buildIssuesCsv, csvField, toCsv } from "./issueExport";

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

/** Minimal RFC 4180 reader for the exporter's own output (every field quoted). */
function parseCsv(csv: string): string[][] {
  expect(csv.startsWith("\uFEFF")).toBe(true);
  const body = csv.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  while (i < body.length) {
    expect(body[i]).toBe('"');
    let field = "";
    i++;
    for (;;) {
      if (body[i] === '"' && body[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (body[i] === '"') {
        i++;
        break;
      } else {
        field += body[i++];
      }
    }
    row.push(field);
    if (body[i] === ",") {
      i++;
    } else {
      expect(body.slice(i, i + 2)).toBe("\r\n");
      i += 2;
      rows.push(row);
      row = [];
    }
  }
  return rows;
}

describe("csvField / toCsv", () => {
  it("quotes commas quotes and newlines", () => {
    expect(csvField("plain")).toBe('"plain"');
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField(42)).toBe('"42"');
    const csv = toCsv([
      ["h1", "h2"],
      ['x,"y"', "multi\r\nline"],
    ]);
    expect(csv).toBe('\uFEFF"h1","h2"\r\n"x,""y""","multi\r\nline"\r\n');
    expect(parseCsv(csv)).toEqual([
      ["h1", "h2"],
      ['x,"y"', "multi\r\nline"],
    ]);
  });

  it("keeps non-ASCII text intact behind a UTF-8 BOM", () => {
    expect(toCsv([["https://example.com/caf\u00e9"]])).toBe('\uFEFF"https://example.com/caf\u00e9"\r\n');
  });
});

describe("CSV injection", () => {
  it("neutralises formula injection", () => {
    expect(csvField('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvField("+1")).toBe(`"'+1"`);
    expect(csvField("-1")).toBe(`"'-1"`);
    expect(csvField("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvField("a=b")).toBe('"a=b"');
    expect(csvField("https://example.com/=x")).toBe('"https://example.com/=x"');
  });
});

describe("buildIssuesCsv", () => {
  it("one row per page issue pair", () => {
    const pages = [
      makePage({ url: "https://example.com/a", title: "Same" }),
      makePage({ url: "https://example.com/b", title: "Same", h1: null, h1Count: 0 }),
      makePage({ url: "https://example.com/c" }),
    ];
    const resources = [makeResource({ url: "https://example.com/missing.png", status: 404 })];
    const ctx = { ...emptyFilterContext(), duplicateTitles: getDuplicateTitleSet(pages) };
    const rows = parseCsv(buildIssuesCsv(pages, resources, ctx));

    expect(rows[0]).toEqual(["URL", "Issue Key", "Issue", "Severity", "Group"]);
    const body = rows.slice(1);
    const pairs = body.map(([url, key]) => `${url} ${key}`);
    // No (URL, issue) pair is listed twice.
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toContain("https://example.com/a duplicateTitles");
    expect(pairs).toContain("https://example.com/b duplicateTitles");
    expect(pairs).toContain("https://example.com/b h1Issues");
    expect(pairs).not.toContain("https://example.com/c duplicateTitles");
    expect(pairs).toContain("https://example.com/missing.png broken");

    // Every row describes its issue with the registry's label, severity and group.
    const defByKey = new Map<string, (typeof ISSUE_DEFS)[number]>(ISSUE_DEFS.map((d) => [d.key, d]));
    for (const [, key, label, severity, group] of body) {
      const def = defByKey.get(key);
      expect(def).toBeDefined();
      expect(label).toBe(def!.label);
      expect(severity).toBe(("tone" in def! && def!.tone) || "info");
      expect(group).toBe(def!.group);
    }

    // Rows per key equal the registry counts.
    const counts = countIssues(pages, resources, ctx);
    for (const def of ISSUE_DEFS) {
      expect(body.filter((r) => r[1] === def.key).length).toBe(counts[def.key]);
    }
  });

  it("writes only the header when nothing was crawled", () => {
    expect(parseCsv(buildIssuesCsv([], [], emptyFilterContext()))).toEqual([
      ["URL", "Issue Key", "Issue", "Severity", "Group"],
    ]);
  });
});

describe("buildIssueSummaryCsv", () => {
  it("summary counts match countIssues", () => {
    const pages = [
      makePage({ url: "https://example.com/a", title: "Same" }),
      makePage({ url: "https://example.com/b", title: "Same", metaDescription: null, metaDescriptionLength: 0 }),
      makePage({ url: "https://example.com/c", status: 404, statusText: "Not Found" }),
    ];
    const resources = [makeResource({ status: 500 }), makeResource({ url: "https://example.com/ok.png" })];
    const ctx = { ...emptyFilterContext(), duplicateTitles: getDuplicateTitleSet(pages) };
    const rows = parseCsv(buildIssueSummaryCsv(pages, resources, ctx));
    const counts = countIssues(pages, resources, ctx);

    expect(rows[0]).toEqual(["Issue Key", "Issue", "Severity", "Group", "Count"]);
    const body = rows.slice(1);
    expect(body.map((r) => r[0])).toEqual(ISSUE_DEFS.map((d) => d.key));
    for (const [key, , , , count] of body) {
      expect(Number(count)).toBe(counts[key as keyof typeof counts]);
    }
    expect(counts.duplicateTitles).toBe(2);
    expect(counts.broken).toBe(1);
  });
});
