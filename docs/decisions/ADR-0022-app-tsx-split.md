# ADR-0022: How App.tsx is split

## Context

T4.1 splits `src/App.tsx` into column modules, an event hook, a session hook and an event
batcher, with the acceptance item that `App.tsx` ends under 450 lines. Moving only the files the
plan lists leaves `App.tsx` at about 550 lines: the derived-state trackers, the link score
throttle and the two detail modal field lists still live there. The plan also leaves open how
state is shared between `App` and the hooks, and how the batcher replaces the single flush timer
that applied pages and resources together.

## Decision

- **State stays in `App`.** Every `useState` for crawl data remains in `App`; the hooks receive
  values and setters as one parameter object and return handlers. No store or context
  (CLAUDE.md, `gseo-ui`).
- **One batcher for pages and resources.** `useCrawlEvents` pushes both kinds into one
  `createEventBatcher<BufferedEvent>` and splits them in the flush, so a flush still updates
  pages and resources in the same callback, as the old shared timer did. `discardPending`
  (the batcher's `cancel`) replaces clearing the two buffer refs when Start wipes the view.
- **Extra modules beyond the plan's list**, needed to reach the line budget:
  - `src/hooks/useDerivedCrawlState.ts`: the incremental tracker refs, `resetDerivedTrackers`,
    the ingestion memo and `filterContext`, moved unchanged. It lives apart from
    `useCrawlSession` because it depends only on `pages`, `linkedUrls` and the list-mode flag,
    and T4.2 reworks exactly this code; the session hook receives `resetDerivedTrackers`.
  - `src/hooks/useThrottledValue.ts`: the link score throttle hook, moved unchanged.
  - `src/lib/detailFields.ts`: the page and resource detail modal rows as pure functions
    (`pageDetailFields`, `resourceDetailFields`), moved unchanged apart from the variable
    names, with tests in `detailFields.test.ts`.

## Consequences

- `App.tsx` composes state, hooks and JSX only. Later UI work touches the smaller files.
- Hook dependency arrays now list the setters they receive. Setters and refs are stable, so the
  listeners still register once on mount and no handler changes identity more often than before.
