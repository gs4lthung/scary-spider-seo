import type { PageResult, ResourceResult } from "../types";
import { type FilterContext, type IssueDef, type IssueKey, type PageIssueDef, type ResourceIssueDef, ISSUE_DEFS } from "./filters";
import { isAppendOf } from "./derivedState";

/** Shortest gap between two cross-page recounts while a crawl is running. */
export const CROSS_PAGE_RECOUNT_MS = 1000;

const ALL_DEFS: readonly IssueDef<IssueKey>[] = ISSUE_DEFS;
const isPageDef = (d: IssueDef<IssueKey>): d is PageIssueDef<IssueKey> => d.scope === "page";
const isResourceDef = (d: IssueDef<IssueKey>): d is ResourceIssueDef<IssueKey> => d.scope === "resource";
const LOCAL_PAGE_DEFS = ALL_DEFS.filter((d) => !d.crossPage).filter(isPageDef);
const LOCAL_RESOURCE_DEFS = ALL_DEFS.filter((d) => !d.crossPage).filter(isResourceDef);
const CROSS_PAGE_DEFS = ALL_DEFS.filter((d) => d.crossPage).filter(isPageDef);
const CROSS_RESOURCE_DEFS = ALL_DEFS.filter((d) => d.crossPage).filter(isResourceDef);

function zeroCounts(): Record<IssueKey, number> {
  const counts = {} as Record<IssueKey, number>;
  for (const def of ALL_DEFS) counts[def.key] = 0;
  return counts;
}

export interface IssueCounterOptions {
  /** Clock in milliseconds; injectable so tests control the throttle. */
  now?: () => number;
  crossPageIntervalMs?: number;
}

/**
 * Overview issue counts that grow with each flush rather than with the crawl. Page-local
 * issues (`crossPage: false`) are tested once per page as it arrives and added to running
 * totals. Cross-page issues can change for any page when another page arrives, so they are
 * recounted over every page, but while a crawl runs (`live`) at most once per
 * `crossPageIntervalMs`; when it is not live (finished, paused, or a loaded crawl) every
 * update recounts them, so the final numbers always equal `countIssues`.
 *
 * `pages` and `resources` are expected to grow by appending; an array that was replaced
 * instead (a new crawl, a loaded one) starts the page-local totals over.
 */
export class IssueCounter {
  private readonly now: () => number;
  private readonly interval: number;
  private local = zeroCounts();
  private cross = zeroCounts();
  private counts = zeroCounts();
  private pagesIngested = 0;
  private lastPage: PageResult | null = null;
  private resourcesIngested = 0;
  private lastResource: ResourceResult | null = null;
  private crossStale = true;
  private lastCrossAt = Number.NEGATIVE_INFINITY;
  private lastPages: readonly PageResult[] | null = null;
  private lastResources: readonly ResourceResult[] | null = null;
  private lastCtx: FilterContext | null = null;

  constructor(options: IssueCounterOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.interval = options.crossPageIntervalMs ?? CROSS_PAGE_RECOUNT_MS;
  }

  /** Brings the counts up to date and returns them. The returned object is replaced only
   * when a count changed, so it can be used as a memo dependency. */
  update(
    pages: readonly PageResult[],
    resources: readonly ResourceResult[],
    ctx: FilterContext,
    live: boolean,
  ): Record<IssueKey, number> {
    if (pages !== this.lastPages || resources !== this.lastResources || ctx !== this.lastCtx) this.crossStale = true;
    this.lastPages = pages;
    this.lastResources = resources;
    this.lastCtx = ctx;
    let changed = this.ingestPages(pages, ctx);
    changed = this.ingestResources(resources, ctx) || changed;

    const now = this.now();
    if (this.crossStale && (!live || now - this.lastCrossAt >= this.interval)) {
      changed = this.recountCross(pages, resources, ctx) || changed;
      this.lastCrossAt = now;
      this.crossStale = false;
    }
    if (changed) this.counts = this.merged();
    return this.counts;
  }

  /** True when the last update skipped a cross-page recount because of the throttle, so the
   * cross-page counts it returned may be behind; an update once the interval has passed (or
   * a not-live one) catches up. */
  hasPendingRecount(): boolean {
    return this.crossStale;
  }

  private ingestPages(pages: readonly PageResult[], ctx: FilterContext): boolean {
    if (!isAppendOf(pages, this.pagesIngested, this.lastPage)) {
      for (const def of LOCAL_PAGE_DEFS) this.local[def.key] = 0;
      this.pagesIngested = 0;
      this.lastCrossAt = Number.NEGATIVE_INFINITY;
    } else if (this.pagesIngested === pages.length) {
      return false;
    }
    for (let i = this.pagesIngested; i < pages.length; i++) {
      const p = pages[i];
      for (const def of LOCAL_PAGE_DEFS) if (def.test(p, ctx)) this.local[def.key]++;
    }
    this.pagesIngested = pages.length;
    this.lastPage = pages.length > 0 ? pages[pages.length - 1] : null;
    return true;
  }

  private ingestResources(resources: readonly ResourceResult[], ctx: FilterContext): boolean {
    if (!isAppendOf(resources, this.resourcesIngested, this.lastResource)) {
      for (const def of LOCAL_RESOURCE_DEFS) this.local[def.key] = 0;
      this.resourcesIngested = 0;
      this.lastCrossAt = Number.NEGATIVE_INFINITY;
    } else if (this.resourcesIngested === resources.length) {
      return false;
    }
    for (let i = this.resourcesIngested; i < resources.length; i++) {
      const r = resources[i];
      for (const def of LOCAL_RESOURCE_DEFS) if (def.test(r, ctx)) this.local[def.key]++;
    }
    this.resourcesIngested = resources.length;
    this.lastResource = resources.length > 0 ? resources[resources.length - 1] : null;
    return true;
  }

  /** Recounts every cross-page issue; true when any count changed. */
  private recountCross(pages: readonly PageResult[], resources: readonly ResourceResult[], ctx: FilterContext): boolean {
    let changed = false;
    const store = (key: IssueKey, n: number) => {
      if (this.cross[key] !== n) changed = true;
      this.cross[key] = n;
    };
    for (const def of CROSS_PAGE_DEFS) {
      let n = 0;
      for (const p of pages) if (def.test(p, ctx)) n++;
      store(def.key, n);
    }
    for (const def of CROSS_RESOURCE_DEFS) {
      let n = 0;
      for (const r of resources) if (def.test(r, ctx)) n++;
      store(def.key, n);
    }
    return changed;
  }

  private merged(): Record<IssueKey, number> {
    const counts = zeroCounts();
    for (const def of ALL_DEFS) counts[def.key] = def.crossPage ? this.cross[def.key] : this.local[def.key];
    return counts;
  }
}
