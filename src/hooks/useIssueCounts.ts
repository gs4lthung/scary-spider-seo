import { useMemo, useState } from "react";
import type { PageResult, ResourceResult } from "@/types";
import type { FilterContext, IssueKey } from "@/lib/filters";
import { IssueCounter } from "@/lib/issueCounter";

/**
 * Overview issue counts, updated per flush in proportion to the new pages (see
 * `IssueCounter`). `live` is true while a crawl is actively running; cross-page counts are
 * then refreshed at most once a second, and in full as soon as it is false again.
 */
export function useIssueCounts(
  pages: PageResult[],
  resources: ResourceResult[],
  filterContext: FilterContext,
  live: boolean,
): Record<IssueKey, number> {
  // One counter for the component's lifetime; it notices a replaced `pages` array by itself.
  const [counter] = useState(() => new IssueCounter());
  return useMemo(
    () => counter.update(pages, resources, filterContext, live),
    [counter, pages, resources, filterContext, live],
  );
}
