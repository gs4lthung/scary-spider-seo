import { describe, expect, it } from "vitest";
import type { PageResult } from "../types";
import { buildTree } from "./SiteTree";

function makePage(url: string): PageResult {
  return {
    url,
    depth: 0,
    status: 200,
    statusText: "OK",
    contentType: "text/html",
    title: "Title",
    titleLength: 5,
    metaDescription: "Desc",
    metaDescriptionLength: 4,
    h1: "H1",
    h1Count: 1,
    wordCount: 100,
    canonical: url,
    metaRobots: null,
    redirectUrl: null,
    indexability: "Indexable",
    responseTimeMs: 100,
    internalLinkCount: 0,
    externalLinkCount: 0,
    imageCount: 0,
    htmlSizeBytes: 1000,
    minifySavingsPct: 0,
    isMinified: true,
    rendered: false,
    hsts: true,
    insecureLinkCount: 0,
    missingAltCount: 0,
    lang: "en",
    hreflangValues: [],
    internalNofollowCount: 0,
    textRatioPct: 20,
    contentHash: url,
    xRobotsTag: null,
    viewport: "width=device-width",
    hasOpenGraph: true,
    hasTwitterCard: true,
    canonicalCount: 1,
    discoveredViaSitemap: false,
    redirectChain: [],
    structuredDataTypes: [],
    structuredDataErrors: [],
    accessibilityViolations: [],
    mobileUsabilityViolations: [],
    error: null,
  };
}

const noIssues = () => 0;

describe("buildTree", () => {
  it("groups pages under one root per host", () => {
    const pages = [makePage("https://a.com/"), makePage("https://b.com/")];
    const roots = buildTree(pages, noIssues);
    expect(roots.map((r) => r.label)).toEqual(["a.com", "b.com"]);
  });

  it("nests pages by URL path segment", () => {
    const pages = [makePage("https://example.com/blog/3pl/foo"), makePage("https://example.com/blog/3pl/bar")];
    const [root] = buildTree(pages, noIssues);
    expect(root.children.map((c) => c.label)).toEqual(["blog"]);
    const blog = root.children[0];
    expect(blog.children.map((c) => c.label)).toEqual(["3pl"]);
    const pl = blog.children[0];
    expect(pl.children.map((c) => c.label).sort()).toEqual(["bar", "foo"]);
  });

  it("attaches a page to the node matching its exact path", () => {
    const pages = [makePage("https://example.com/about")];
    const [root] = buildTree(pages, noIssues);
    const about = root.children[0];
    expect(about.label).toBe("about");
    expect(about.pages).toEqual(pages);
  });

  it("puts the root page (host with no path) on the host node itself", () => {
    const pages = [makePage("https://example.com/")];
    const [root] = buildTree(pages, noIssues);
    expect(root.children).toEqual([]);
    expect(root.pages).toEqual(pages);
  });

  it("aggregates totalPages up the tree, including intermediate directories with no page of their own", () => {
    const pages = [
      makePage("https://example.com/blog/a"),
      makePage("https://example.com/blog/b"),
      makePage("https://example.com/blog/c/d"),
    ];
    const [root] = buildTree(pages, noIssues);
    expect(root.totalPages).toBe(3);
    const blog = root.children[0];
    expect(blog.label).toBe("blog");
    expect(blog.pages).toEqual([]); // no page crawled at exactly /blog
    expect(blog.totalPages).toBe(3);
  });

  it("aggregates issue counts up the tree using the supplied counter", () => {
    const pages = [makePage("https://example.com/blog/a"), makePage("https://example.com/blog/b")];
    const issuesOf = (p: PageResult) => (p.url.endsWith("/a") ? 2 : 0);
    const [root] = buildTree(pages, issuesOf);
    const blog = root.children[0];
    expect(blog.totalIssues).toBe(2);
    expect(root.totalIssues).toBe(2);
  });

  it("sorts children by descending page count, then alphabetically", () => {
    const pages = [
      makePage("https://example.com/z"),
      makePage("https://example.com/popular/1"),
      makePage("https://example.com/popular/2"),
      makePage("https://example.com/popular/3"),
      makePage("https://example.com/a"),
    ];
    const [root] = buildTree(pages, noIssues);
    expect(root.children.map((c) => c.label)).toEqual(["popular", "a", "z"]);
  });

  it("ignores pages with an unparseable URL instead of throwing", () => {
    const pages = [makePage("not a url"), makePage("https://example.com/fine")];
    expect(() => buildTree(pages, noIssues)).not.toThrow();
    const roots = buildTree(pages, noIssues);
    expect(roots).toHaveLength(1);
    expect(roots[0].label).toBe("example.com");
  });
});
