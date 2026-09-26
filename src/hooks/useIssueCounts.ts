import { useEffect, useMemo, useState } from "react";
import type { PageResult, ResourceResult } from "@/types";
import type { FilterContext, IssueKey } from "@/lib/filters";
import { CROSS_PAGE_RECOUNT_MS, IssueCounter } from "@/lib/issueCounter";

/**
 * Overview issue counts, updated per flush in proportion to the new pages (see
 * `IssueCounter`). `live` is true while a crawl is actively running; cross-page counts are
 * then refreshed at most once a second, and in full as soon as it is false again. When a live
 * update skipped the cross-page recount, one trailing timer re-runs the update a second
 * later, so the counts catch up even if the crawl stalls and no further flush arrives.
 */
export function useIssueCounts(
  pages: PageResult[],
  resources: ResourceResult[],
  filterContext: FilterContext,
  live: boolean,
): Record<IssueKey, number> {
  // One counter for the component's lifetime; it notices a replaced `pages` array by itself.
  const [counter] = useState(() => new IssueCounter());
  // Bumped by the trailing timer to re-run the update with unchanged inputs.
  const [retry, setRetry] = useState(0);
  const counts = useMemo(
    () => counter.update(pages, resources, filterContext, live),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `retry` is not read; it only re-runs the update
    [counter, pages, resources, filterContext, live, retry],
  );
  useEffect(() => {
    if (!live || !counter.hasPendingRecount()) return;
    // A newer flush (a dependency change) clears this timer and schedules its own.
    const id = window.setTimeout(() => setRetry((n) => n + 1), CROSS_PAGE_RECOUNT_MS);
    return () => window.clearTimeout(id);
  }, [counter, counts, live, pages, resources, filterContext, retry]);
  return counts;
}
