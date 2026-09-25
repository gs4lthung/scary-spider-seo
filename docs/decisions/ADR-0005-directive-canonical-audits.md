# ADR-0005: Directive and canonical audit decisions (T1.4)

## Context

T1.4 adds eight issues derived from data already crawled: `directiveNoindex`,
`directiveNofollow`, `directiveNone`, `xRobotsTagPresent`, `missingCanonical`,
`canonicalised`, `canonicalToNonIndexable` and `canonicalToRedirect`. The plan fixes the
predicates in outline but leaves several edge cases open.

## Decision

- **Directive parsing.** `parseRobotsDirectives` merges meta robots and `X-Robots-Tag`
  into one set. A `name: value` token is treated as a user-agent prefix and dropped
  (`googlebot: noindex` becomes `noindex`) unless the name is a valued directive
  (`max-snippet`, `max-image-preview`, `max-video-preview`, `unavailable_after`), which is
  kept as `name:value` without spaces. Any bot name counts, as in Screaming Frog; the
  crawler only stores one meta robots value (`name="robots"`).
- **`none` stays separate.** `directiveNoindex` and `directiveNofollow` match only the
  literal tokens, matching Screaming Frog's separate "None" filter. `none` gets `warn`
  tone because it is the one most often added by mistake.
- **`xRobotsTagPresent`** means "the header carries at least one directive", matching
  Screaming Frog's X-Robots-Tag filter, whether or not the page also has meta robots.
- **`missingCanonical`** applies to 2xx pages with parsed HTML (`htmlSizeBytes > 0`) that
  were not redirected (`redirectUrl` empty). A redirected URL is stored with the final
  status and the destination's body, so flagging it would report the destination's issue
  on the source URL.
- **Self-referencing canonicals are skipped** by `canonicalToNonIndexable` and
  `canonicalToRedirect` (as `brokenCanonicalTarget` already does). A noindex page with a
  self canonical is reported by `directiveNoindex`, not as a canonical problem.
- **Overlap is kept.** Following the plan's predicate literally, a canonical pointing at a
  redirect or at a 4xx page is also "non-indexable", so it can appear under
  `canonicalToNonIndexable` and under `canonicalToRedirect` or `brokenCanonicalTarget`.
- **Tones.** Directives and `canonicalised` are neutral (often intended);
  `missingCanonical` and `canonicalToRedirect` are `warn`; `canonicalToNonIndexable` is
  `bad`. All sit in the "Canonical & Indexing" Overview section.
- **`pageByUrl`** is maintained incrementally in `App.tsx` next to `canonicalStatusMap`
  (same ref-and-copy pattern), so no new per-batch full scan is introduced.

## Consequences

- No Rust or saved-crawl format change: every check reads existing fields.
- The crawler's own `indexability` still treats only a `noindex` substring as noindex, so
  a page with `none` is `Indexable` there and not flagged by `canonicalToNonIndexable`
  when it is a canonical target. Aligning the crawler is left to a later task.
- Copying `pageByUrl` per UI batch is O(n), the same cost `canonicalStatusMap` already
  pays; T4.2 is where incremental derived state gets optimised.
