// Page and resource builders for the incremental-state tests. Not used by the app.
import type { PageResult, ResourceResult } from "../types";

export function makeTestPage(overrides: Partial<PageResult> = {}): PageResult {
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

/** Deterministic PRNG (mulberry32), so a "random" crawl is the same on every run. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pageUrl = (i: number) => `https://example.com/p${i}`;

/**
 * `count` pages with values drawn from small pools, so every cross-page issue (duplicates,
 * near duplicates, canonical targets, link graph, hreflang, pagination, sitemap) and most
 * page-local ones occur. Links, canonicals and hreflang point both backwards and forwards,
 * including at URLs that never get crawled.
 */
export function randomPages(count: number, seed = 1): PageResult[] {
  const rnd = seededRandom(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
  const chance = (p: number) => rnd() < p;
  const anyUrl = () => pageUrl(Math.floor(rnd() * count * 1.1));
  const statuses = [200, 200, 200, 200, 200, 301, 404, 500, null] as const;
  const simhashes = ["0000000000000000", "0000000000000001", "0000000000000003", "ffff0000ffff0000", "ffff0000ffff0001", ""];
  const pages: PageResult[] = [];
  for (let i = 0; i < count; i++) {
    const status = pick(statuses);
    const redirected = status === 301 || chance(0.05);
    const title = chance(0.1) ? null : `Title ${Math.floor(rnd() * count * 0.8)}${chance(0.3) ? " padded to a reasonable length" : ""}`;
    const meta = chance(0.1) ? null : `Meta description ${Math.floor(rnd() * count * 0.8)}`;
    const h1 = chance(0.1) ? null : `H1 ${Math.floor(rnd() * count * 0.8)}`;
    const h2 = `H2 ${Math.floor(rnd() * count * 0.8)}`;
    const outlinks = Array.from({ length: Math.floor(rnd() * 6) }, () => ({
      url: anyUrl(),
      anchor: pick(["Read more", "click here", "", "Pricing"]),
      nofollow: chance(0.05),
      isImageLink: false,
    }));
    const hreflangLinks = chance(0.2)
      ? [
          { lang: "en", href: pageUrl(i) },
          { lang: pick(["de", "fr", "zz-invalid", "x-default"]), href: anyUrl() },
        ]
      : [];
    pages.push(
      makeTestPage({
        url: pageUrl(i),
        depth: Math.floor(rnd() * 6),
        status: status === 301 ? 200 : status,
        redirectChain: redirected ? [pageUrl(i) + "-old"] : [],
        redirectUrl: redirected ? anyUrl() : null,
        title,
        titleLength: title?.length ?? 0,
        metaDescription: meta,
        metaDescriptionLength: meta?.length ?? 0,
        h1,
        h1Count: h1 ? pick([1, 1, 2]) : 0,
        h1Values: h1 ? [h1] : [],
        h2Values: chance(0.2) ? [] : [h2],
        h2Count: chance(0.2) ? 0 : pick([1, 2]),
        headingLevels: pick([[1, 2], [1, 3], []]),
        canonical: pick([null, pageUrl(i), anyUrl(), anyUrl()]),
        indexability: pick(["Indexable", "Indexable", "Indexable", "Non-Indexable", "Canonicalised"]),
        htmlSizeBytes: chance(0.1) ? 0 : 10000,
        contentHash: `hash${Math.floor(rnd() * count * 0.9)}`,
        contentSimhash: pick(simhashes),
        discoveredViaSitemap: chance(0.5),
        outlinks,
        hreflangLinks,
        hreflangValues: hreflangLinks.map((l) => l.lang),
        paginationNext: chance(0.1) ? anyUrl() : null,
        paginationPrev: chance(0.05) ? anyUrl() : null,
        wordCount: Math.floor(rnd() * 600),
        responseTimeMs: Math.floor(rnd() * 900),
        missingAltCount: chance(0.2) ? 1 : 0,
        customSearchCounts: chance(0.5) ? { r1: Math.floor(rnd() * 3) } : {},
      }),
    );
  }
  return pages;
}

export function randomResources(count: number, seed = 2): ResourceResult[] {
  const rnd = seededRandom(seed);
  return Array.from({ length: count }, (_, i) => ({
    url: `https://example.com/r${i}.png`,
    resourceType: rnd() < 0.7 ? "image" : "link",
    sourcePage: pageUrl(i),
    altText: null,
    status: rnd() < 0.1 ? 404 : 200,
    statusText: "",
    isInternal: true,
    isInsecure: rnd() < 0.1,
    error: rnd() < 0.05 ? "timeout" : null,
    contentLength: Math.floor(rnd() * 200_000),
  }));
}
