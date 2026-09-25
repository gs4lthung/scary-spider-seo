---
name: gseo-audit-checks
description: How to add or change an SEO/accessibility audit check (an "issue" or filter) in gseo end to end: raw signal, classification in filters.ts, solution text, Overview count, table column, tests. Use for any Screaming Frog style check such as URL, title, canonical, hreflang, security-header, image or link issues.
---

# Adding an audit check

A check is a `FilterKey`. Its logic lives once, in `filterPages` (`src/lib/filters.ts`); everything else reuses it.

Once task T1.1 has merged (an `ISSUE_DEFS` registry exists in `filters.ts`), a check is one `ISSUE_DEFS` entry (key, label, group, tone, predicate) plus its `ISSUE_SOLUTIONS` entry; Overview counts and page issue keys come from the registry, so skip steps 2 and 4 below except where they still apply.

## Steps

1. **Decide where the signal comes from.** If it can be derived from fields already on `PageResult`/`ResourceResult` (see `src/types.ts`), it's frontend-only. Otherwise add a raw field first with the `gseo-crawler` skill.
2. **Classify** in `src/lib/filters.ts`:
   - add the key to the `FilterKey` union;
   - add a `case` to `filterPages` (or `filterResources` for resource checks);
   - add it to `ALL_PAGE_ISSUE_KEYS` so `getPageIssueKeys` reports it on the page detail;
   - thresholds are exported `const`s (like `TITLE_MAX_LENGTH`), never inline numbers;
   - cross-page checks (duplicates, inlinks, canonical targets) take a precomputed `Set`/`Map` argument built by a `get…` helper, like `getDuplicateTitleSet`. Keep them O(n): no per-page scan of all pages.
   - HTML-only checks guard with `p.htmlSizeBytes > 0` so non-HTML and blocked URLs don't match.
3. **Explain it** in `src/lib/issueSolutions.ts`: `title`, `problem`, `fix`, and a `source` link to primary documentation (Google Search Central, MDN, W3C, web.dev). No em dashes.
4. **Count it** in `src/components/Overview.tsx`: the summary loop has one counter per key and a card entry with `tone` (`error` for things that break indexing or users, `warn` otherwise). Keep the count consistent with `filterPages`; prefer calling the shared helper over re-implementing the predicate.
5. **Show the data** if it's a new field: a column in the `columns` array in `src/App.tsx` and a line in the page detail, plus a CSV column in `src-tauri/src/export.rs`.
6. **Test it:**
   - `src/lib/filters.test.ts`: a matching and a non-matching page built with `makePage({...})`, the boundary value on each side of any threshold, and the key appearing in `getPageIssueKeys`.
   - For a new raw field: a fixture-site page and assertion (see `gseo-crawler`).
7. **Find every touchpoint** by grepping an existing similar key, e.g. `grep -rn missingViewport src src-tauri/src`, and make sure your key appears in the same places.

## Conventions

- Key names are camelCase and describe the problem (`titleTooLong`, `missingHsts`), not the fix.
- An issue must be actionable on that URL. Site-wide facts go in `SiteInfoPanel`, not in a per-page filter.
- Match Screaming Frog's definitions where one exists (e.g. URL over 115 characters, image over 100 KB) and cite the threshold's source in `issueSolutions.ts`.
