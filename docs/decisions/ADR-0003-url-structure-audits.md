# ADR-0003: URL structure audit details (T1.2)

## Context

T1.2 adds six URL structure issues. The plan fixes the keys, the 2xx/3xx guard, and says
predicates run on the path plus query and that non-ASCII URLs are decoded for display. It is
silent on a few details.

## Decision

1. **Length is measured on the full URL.** `urlOver115` compares `page.url.length` with
   `URL_MAX_LENGTH`, like Screaming Frog's "Over 115 Characters" filter, which the goal and
   the `gseo-audit-checks` skill name as the definition. The other five checks look only at
   the path and query, so the host never triggers them.
2. **Uppercase ignores percent-escape hex digits.** `%C3` is uppercase by URL convention, so
   escapes are stripped before looking for `A-Z`; otherwise every non-ASCII URL would also
   count as uppercase.
3. **Underscores and uppercase include the query**, as the plan says; `urlMultipleSlashes`
   checks the path only, so a URL in a query value (`?to=https://...`) is not flagged.
4. **Overview section "URL"**, appended after "International". `urlParameters` and
   `urlUnderscores` are neutral (informational); the other four are `warn`.
5. **Decode for display in `LinkCell`.** `decodeUrlForDisplay` (`src/lib/url.ts`, `decodeURI`
   with a fallback) is applied to the visible text of every URL cell. The `title` tooltip and
   the link that opens keep the URL exactly as crawled, and search/filtering still use the
   stored form.
6. **No separate key for spaces or other percent-encoded ASCII.** The goal mentions them, but
   the plan's file list and acceptance name exactly six keys; encoded ASCII (for example
   `%20`) is not flagged by `urlNonAscii`. A later task can add `urlEncodedCharacters` if
   wanted.

## Consequences

- A URL with a long host can be flagged by `urlOver115` even when its path is short.
- URL columns now show `café` instead of `caf%C3%A9`; copying from the tooltip still gives the
  crawled form.
- Parsing each URL is cached per `PageResult` object (a `WeakMap`), so recounts stay cheap.
