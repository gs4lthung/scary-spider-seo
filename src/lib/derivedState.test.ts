import { describe, expect, it } from "vitest";
import { buildCrawlFilterContext } from "./compareCrawls";
import { buildFilterContext, createDerivedCrawlState, syncDerivedCrawlState } from "./derivedState";
import { countIssues } from "./filters";
import { randomPages } from "./testPages";

function linkedUrlsOf(pages: ReturnType<typeof randomPages>): Set<string> {
  const linked = new Set<string>();
  for (const p of pages) for (const l of p.outlinks) linked.add(l.url);
  return linked;
}

describe("syncDerivedCrawlState", () => {
  it("builds the same context in batches as the one-pass build of a finished crawl", () => {
    const pages = randomPages(600, 7);
    let state = createDerivedCrawlState();
    for (let end = 0; end < pages.length; end += 37) state = syncDerivedCrawlState(state, pages.slice(0, end));
    state = syncDerivedCrawlState(state, pages);
    const incremental = buildFilterContext(state.trackers, linkedUrlsOf(pages), false);
    const reference = buildCrawlFilterContext(pages);
    expect(incremental.duplicateTitles).toEqual(reference.duplicateTitles);
    expect(incremental.duplicateContent).toEqual(reference.duplicateContent);
    expect(incremental.duplicateMeta).toEqual(reference.duplicateMeta);
    expect(incremental.duplicateH1s).toEqual(reference.duplicateH1s);
    expect(incremental.duplicateH2s).toEqual(reference.duplicateH2s);
    expect(incremental.canonicalStatusMap).toEqual(reference.canonicalStatusMap);
    expect(incremental.non200LinkSources).toEqual(reference.non200LinkSources);
    expect(incremental.hreflangMissingReturn).toEqual(reference.hreflangMissingReturn);
    expect(incremental.hreflangTargetError).toEqual(reference.hreflangTargetError);
    expect(incremental.sitemapUsed).toBe(reference.sitemapUsed);
    expect([...incremental.nearDuplicates.keys()].sort()).toEqual([...reference.nearDuplicates.keys()].sort());
    expect(countIssues(pages, [], incremental)).toEqual(countIssues(pages, [], reference));
  });

  it("returns the same state when no page was added, and a new version when one was", () => {
    const pages = randomPages(10);
    const first = syncDerivedCrawlState(createDerivedCrawlState(), pages);
    expect(syncDerivedCrawlState(first, pages)).toBe(first);
    const next = syncDerivedCrawlState(first, [...pages, ...randomPages(1, 99)]);
    expect(next.version).toBe(first.version + 1);
    expect(next.trackers).toBe(first.trackers);
  });

  it("starts over when pages is replaced rather than appended to", () => {
    const first = syncDerivedCrawlState(createDerivedCrawlState(), randomPages(20, 1));
    const replacement = randomPages(30, 2);
    const next = syncDerivedCrawlState(first, replacement);
    expect(next.trackers).not.toBe(first.trackers);
    expect(next.trackers.pageByUrl.size).toBe(new Set(replacement.map((p) => p.url)).size);
    expect(next.trackers.pageByUrl.get(replacement[0].url)).toBe(replacement[0]);
  });

  it("shares the trackers' collections instead of copying them", () => {
    const state = syncDerivedCrawlState(createDerivedCrawlState(), randomPages(50));
    const ctx = buildFilterContext(state.trackers, new Set(), false);
    expect(ctx.duplicateTitles).toBe(state.trackers.duplicateTitles.duplicates);
    expect(ctx.pageByUrl).toBe(state.trackers.pageByUrl);
    expect(ctx.canonicalStatusMap).toBe(state.trackers.canonicalStatusMap);
    expect(ctx.nearDuplicates).toBe(ctx.nearDuplicates);
  });
});
