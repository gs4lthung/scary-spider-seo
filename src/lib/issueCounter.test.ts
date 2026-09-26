import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageResult, ResourceResult } from "../types";
import { type DerivedCrawlState, buildFilterContext, createDerivedCrawlState, syncDerivedCrawlState } from "./derivedState";
import { type FilterContext, type IssueKey, ISSUE_DEFS, countIssues } from "./filters";
import { CROSS_PAGE_RECOUNT_MS, IssueCounter } from "./issueCounter";
import { bestTimeMs } from "./testTiming";
import { randomPages, randomResources } from "./testPages";

/** Feeds `pages` and `resources` to a live crawl in batches, the way App's flushes do: the
 * derived trackers ingest the batch, a new context is built, and `onBatch` sees the result. */
function crawlInBatches(
  pages: PageResult[],
  resources: ResourceResult[],
  batchSize: number,
  onBatch: (pageSlice: PageResult[], resourceSlice: ResourceResult[], ctx: FilterContext) => void,
): void {
  let state: DerivedCrawlState = createDerivedCrawlState();
  const linked = new Set<string>();
  for (let end = batchSize; end < pages.length + batchSize; end += batchSize) {
    const pageSlice = pages.slice(0, Math.min(end, pages.length));
    const resourceSlice = resources.slice(0, Math.min(end, resources.length));
    state = syncDerivedCrawlState(state, pageSlice);
    for (const p of pageSlice.slice(end - batchSize)) for (const l of p.outlinks) linked.add(l.url);
    onBatch(pageSlice, resourceSlice, buildFilterContext(state.trackers, new Set(linked), false));
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IssueCounter", () => {
  it("matches countIssues after incremental ingestion", () => {
    const pages = randomPages(2000, 11);
    const resources = randomResources(1500, 12);
    const counter = new IssueCounter();
    let last: Record<IssueKey, number> | null = null;
    crawlInBatches(pages, resources, 37, (pageSlice, resourceSlice, ctx) => {
      last = counter.update(pageSlice, resourceSlice, ctx, false);
      expect(last).toEqual(countIssues(pageSlice, resourceSlice, ctx));
    });
    // Every key in the registry is compared, and the random crawl hits nearly all of them.
    const final = last as unknown as Record<IssueKey, number>;
    expect(Object.keys(final).sort()).toEqual(ISSUE_DEFS.map((d) => d.key).sort());
    for (const def of ISSUE_DEFS.filter((d) => d.crossPage)) expect(final[def.key], def.key).toBeGreaterThan(0);
  }, 60_000);

  it("ingests each page once", () => {
    const pages = randomPages(400, 21);
    const spies = ISSUE_DEFS.filter((d) => !d.crossPage && d.scope === "page").map((def) =>
      vi.spyOn(def as { test: (...args: never[]) => boolean }, "test"),
    );
    const counter = new IssueCounter({ now: () => 0 });
    crawlInBatches(pages, [], 37, (pageSlice, resourceSlice, ctx) => {
      // Repeat updates (a re-render, a context change without new pages) ingest nothing.
      counter.update(pageSlice, resourceSlice, ctx, true);
      counter.update(pageSlice, resourceSlice, ctx, true);
      counter.update(pageSlice, resourceSlice, { ...ctx }, false);
    });
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(pages.length);
  });

  it("recomputes cross-page counts on finish", () => {
    const pages = randomPages(600, 31);
    let clock = 0;
    const counter = new IssueCounter({ now: () => clock });
    const snapshots: Array<{ pages: PageResult[]; ctx: FilterContext }> = [];
    crawlInBatches(pages, [], 50, (pageSlice, _resources, ctx) => snapshots.push({ pages: pageSlice, ctx }));

    // The first live update recounts; the next ones within the interval keep those counts.
    const first = counter.update(snapshots[0].pages, [], snapshots[0].ctx, true);
    expect(first).toEqual(countIssues(snapshots[0].pages, [], snapshots[0].ctx));
    const later = snapshots[snapshots.length - 1];
    clock = CROSS_PAGE_RECOUNT_MS - 1;
    const throttled = counter.update(later.pages, [], later.ctx, true);
    const expected = countIssues(later.pages, [], later.ctx);
    expect(throttled.duplicateTitles).toBe(first.duplicateTitles);
    expect(throttled.duplicateTitles).not.toBe(expected.duplicateTitles);
    // Page-local counts are never held back.
    expect(throttled.missingTitle).toBe(expected.missingTitle);

    // A second later a live update recounts again.
    clock = CROSS_PAGE_RECOUNT_MS;
    expect(counter.update(later.pages, [], later.ctx, true)).toEqual(expected);

    // Finishing recounts at once, whatever the clock says.
    const extra = randomPages(620, 31);
    let state = syncDerivedCrawlState(createDerivedCrawlState(), extra);
    state = syncDerivedCrawlState(state, extra);
    const finishedCtx = buildFilterContext(state.trackers, later.ctx.linkedUrls, false);
    const counter2 = new IssueCounter({ now: () => clock });
    counter2.update(later.pages, [], later.ctx, true);
    expect(counter2.update(extra, [], finishedCtx, false)).toEqual(countIssues(extra, [], finishedCtx));
  });

  it("starts over when pages are replaced", () => {
    const counter = new IssueCounter({ now: () => 0 });
    crawlInBatches(randomPages(300, 41), [], 100, (p, r, ctx) => counter.update(p, r, ctx, true));
    const replacement = randomPages(120, 42);
    const state = syncDerivedCrawlState(createDerivedCrawlState(), replacement);
    const ctx = buildFilterContext(state.trackers, new Set(), false);
    // Still live and inside the interval: a replaced crawl must not keep the old cross counts.
    expect(counter.update(replacement, [], ctx, true)).toEqual(countIssues(replacement, [], ctx));
  });

  it("returns the same object while nothing changed", () => {
    const pages = randomPages(50, 51);
    const state = syncDerivedCrawlState(createDerivedCrawlState(), pages);
    const ctx = buildFilterContext(state.trackers, new Set(), false);
    const resources = randomResources(10);
    const counter = new IssueCounter();
    const first = counter.update(pages, resources, ctx, false);
    expect(counter.update(pages, resources, ctx, false)).toBe(first);
  });

  it("50k pages in 100 page batches stays under 2 s total", () => {
    const pages = randomPages(50_000, 61);
    const resources = randomResources(20_000, 62);
    const BATCH = 100;
    const BUDGET_MS = 2000;
    // Batches arrive back to back and the clock advances as if the whole feed took exactly its
    // budget, so the throttle allows a live cross-page recount once per budgeted second (at
    // 0 ms and 1000 ms); the final, not-live update is the finished crawl's full recount.
    const FLUSH_MS = BUDGET_MS / (pages.length / BATCH);
    // One flush's work, as App does it: ingest the batch into the trackers, build the context,
    // update the counts.
    const crawl = () => {
      let clock = 0;
      const counter = new IssueCounter({ now: () => clock });
      let state = createDerivedCrawlState();
      const linked = new Set<string>();
      let counts: Record<IssueKey, number> | null = null;
      for (let end = BATCH; end <= pages.length; end += BATCH) {
        const pageSlice = pages.slice(0, end);
        state = syncDerivedCrawlState(state, pageSlice);
        const ctx = buildFilterContext(state.trackers, linked, false);
        counts = counter.update(pageSlice, resources.slice(0, Math.min(end, resources.length)), ctx, end < pages.length);
        clock += FLUSH_MS;
      }
      return counts;
    };
    crawl(); // warm-up, so the JIT has compiled the hot loops
    const ms = bestTimeMs(crawl, BUDGET_MS);
    console.log(`IssueCounter: 50k pages in ${BATCH} page batches took ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(BUDGET_MS);
  }, 60_000);
});
