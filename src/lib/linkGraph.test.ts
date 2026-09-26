import { describe, expect, it } from "vitest";
import type { LinkRef, PageResult } from "../types";
import {
  addPageToLinkGraph,
  buildLinkGraph,
  createLinkGraph,
  getInlinkCount,
  getInlinks,
  getUniqueInlinkCount,
  linkScore,
} from "./linkGraph";

const url = (path: string) => `https://example.com/${path}`;

function link(path: string, overrides: Partial<LinkRef> = {}): LinkRef {
  return { url: url(path), anchor: path, nofollow: false, isImageLink: false, ...overrides };
}

// The graph only reads `url` and `outlinks`, so the rest of PageResult is left out.
function page(path: string, outlinks: LinkRef[] = []): PageResult {
  return { url: url(path), outlinks } as unknown as PageResult;
}

describe("buildLinkGraph", () => {
  it("counts inlinks and unique inlinks", () => {
    const graph = buildLinkGraph([
      page("", [link("a"), link("a", { anchor: "again" }), link("b")]),
      page("a", [link("b"), link("a")]),
      page("b"),
    ]);
    expect(getInlinkCount(graph, url("a"))).toBe(2);
    expect(getUniqueInlinkCount(graph, url("a"))).toBe(1);
    expect(getInlinkCount(graph, url("b"))).toBe(2);
    expect(getUniqueInlinkCount(graph, url("b"))).toBe(2);
    expect(getInlinkCount(graph, url(""))).toBe(0);
    expect(getInlinks(graph, url("a")).map((l) => [l.source, l.anchor])).toEqual([
      [url(""), "a"],
      [url(""), "again"],
    ]);
  });

  it("ignores a page's links to itself", () => {
    const graph = buildLinkGraph([page("a", [link("a")])]);
    expect(getInlinkCount(graph, url("a"))).toBe(0);
  });

  it("keeps nofollow and image flags on inlinks", () => {
    const graph = buildLinkGraph([page("", [link("a", { nofollow: true, isImageLink: true, anchor: "Logo" })])]);
    expect(getInlinks(graph, url("a"))).toEqual([
      { source: url(""), anchor: "Logo", nofollow: true, isImageLink: true },
    ]);
  });

  it("builds the same graph incrementally as in one pass", () => {
    const pages = [page("", [link("a"), link("b")]), page("a", [link("b")]), page("b", [link("")])];
    const incremental = createLinkGraph();
    for (const p of pages) addPageToLinkGraph(incremental, p);
    expect(incremental).toEqual(buildLinkGraph(pages));
  });

  it("tolerates pages from crawls saved before outlinks existed", () => {
    const legacy = { url: url("old") } as unknown as PageResult;
    const graph = buildLinkGraph([legacy]);
    expect(getInlinkCount(graph, url("old"))).toBe(0);
    expect(linkScore(graph).get(url("old"))).toBe(100);
  });
});

describe("linkScore", () => {
  it("link score ranks a hub above a leaf", () => {
    // Every leaf links to the hub; the hub links to every leaf.
    const leaves = ["a", "b", "c", "d"];
    const graph = buildLinkGraph([
      page("", leaves.map((l) => link(l))),
      ...leaves.map((l) => page(l, [link("")])),
    ]);
    const scores = linkScore(graph);
    expect(scores.get(url(""))).toBe(100);
    for (const leaf of leaves) {
      expect(scores.get(url(leaf))!).toBeLessThan(100);
      expect(scores.get(url(leaf))!).toBeGreaterThan(0);
    }
  });

  it("ignores nofollow links", () => {
    const graph = buildLinkGraph([page("", [link("a"), link("b", { nofollow: true })]), page("a"), page("b")]);
    const scores = linkScore(graph);
    expect(scores.get(url("a"))!).toBeGreaterThan(scores.get(url("b"))!);
  });

  it("link score is stable for a graph with no links", () => {
    const graph = buildLinkGraph([page(""), page("a"), page("b")]);
    const scores = linkScore(graph);
    expect([...scores.values()]).toEqual([100, 100, 100]);
    expect(linkScore(graph, 50)).toEqual(scores);
    expect(linkScore(buildLinkGraph([])).size).toBe(0);
  });

  it("scores stay within 0 to 100", () => {
    const graph = buildLinkGraph([page("", [link("a")]), page("a", [link("b")]), page("b"), page("c")]);
    for (const score of linkScore(graph).values()) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("handles 20k pages under 500 ms", () => {
    const count = 20_000;
    const pages: PageResult[] = [];
    for (let i = 0; i < count; i++) {
      // Navigation to the first 20 pages plus 10 pseudo-random contextual links.
      const outlinks: LinkRef[] = [];
      for (let n = 0; n < 20; n++) outlinks.push(link(`p${n}`));
      for (let n = 1; n <= 10; n++) outlinks.push(link(`p${(i * 7919 + n * 104_729) % count}`));
      pages.push(page(`p${i}`, outlinks));
    }
    const start = performance.now();
    const graph = buildLinkGraph(pages);
    const scores = linkScore(graph);
    const elapsed = performance.now() - start;
    expect(scores.size).toBe(count);
    expect(elapsed).toBeLessThan(500);
  });
});
