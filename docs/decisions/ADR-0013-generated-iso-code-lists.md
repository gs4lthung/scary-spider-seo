# ADR-0013: Generated ISO code lists and hreflang audit rules

Status: accepted (T2.6)

## Context

T2.6 validates hreflang codes "against ISO 639-1 languages and ISO 3166-1 alpha-2 regions
(static lists in the file)" and adds five cross-page hreflang issues. The plan leaves open:

- How the static code lists are produced and kept correct. Typing roughly 430 two-letter codes
  by hand is error prone and hard to review.
- What counts as a self-reference, which targets get the return-link check, and what a target
  "error" is.
- How the cross-page checks stay cheap while the Overview recounts every ~150 ms flush.
- How crawls saved before `hreflang_links` existed behave.

## Decision

**Code lists are generated.** `scripts/gen-iso-codes.mjs` enumerates every pair `aa`..`zz` and
keeps a code when the ICU data bundled with Node (`Intl.DisplayNames`, `fallback: "none"`) has
an English name for it and `Intl.getCanonicalLocales` does not rewrite it (this drops deprecated
aliases such as `iw` or `UK`). Region codes ICU knows but ISO 3166-1 does not assign to a
country (`EU`, `EZ`, `UN`, `QO`, `XA`, `XB`, `XK`, `ZZ` and the exceptionally reserved `AC`,
`CP`, `CQ`, `DG`, `EA`, `IC`, `TA`) are excluded explicitly. The script writes
`src/lib/isoCodes.ts` (two `ReadonlySet<string>`s, packed as space-separated strings) with a
"generated, do not edit" header; `src/lib/hreflang.ts` imports it. With Node 24 the result is
183 languages and 249 regions, the sizes of the ISO lists. No new dependency is needed.

**Code syntax.** A valid value is `x-default`, `ll` or `ll-RR` (case-insensitive), with `ll`
in the language set and `RR` in the region set. Script subtags and underscores are rejected,
matching the plan's "language plus optional region" rule and Google's documented format.

**Self-reference** is any hreflang link (including `x-default`) whose href equals the page URL.

**Return links and target errors** are evaluated per (source, target) pair only once the target
was crawled. A target is in error when it was not robots-blocked and it answered non-200, was
reached through a redirect, or is not `Indexable`; the source page gets `hreflangTargetError`.
Otherwise, when the target is an HTML page whose `hreflang_links` do not point back at the
source, the source gets `hreflangMissingReturn`. Links to the page itself are skipped.

**Incremental.** A `HreflangTracker` (in `filters.ts`, fed from the same per-page ingest loop
in `App.tsx` as the non-200 link sources) evaluates each pair once: a page's own targets are
checked against pages already crawled, and targets not crawled yet park the source in a
`waiting` map that is drained when that target arrives. The Overview recount then does O(1)
set lookups. The per-page checks (self, x-default, invalid code) are cached per page object.

**Old crawls.** Pages saved before T2.6 deserialize with empty `hreflang_links`, so none of the
five checks fire for them (the existing `missingHreflang` check still uses `hreflang_values`).

## Consequences

- Regenerating on a newer Node picks up ISO changes from ICU; the diff of `isoCodes.ts` shows
  exactly which codes moved.
- Off-host hreflang targets are never crawled, so they are neither return-checked nor reported
  as errors; they stay in the tracker's `waiting` map for the life of the crawl.
- `FilterContext` gains `hreflangMissingReturn` and `hreflangTargetError` sets.
