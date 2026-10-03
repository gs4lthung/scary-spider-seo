# ADR-0010: Multiple titles, meta refresh and pagination targets

Status: accepted (T2.2)

## Context

T2.2 adds `titleCount`, `metaDescriptionCount`, `metaRefresh`, `paginationNext` and
`paginationPrev`, plus the issues `multipleTitles`, `multipleMetaDescriptions`, `metaRefresh`
and `paginationTargetError`. The plan leaves a few details open:

- Inline SVG commonly contains `<title>` elements (accessible names for icons). A plain
  `title` selector matches them too, which would flag nearly every page with SVG icons.
- Which refresh / pagination tag wins when a page has several, and what an empty value means.
- What "non-200 or not crawled" means for a pagination target, given the crawler stores the
  final status on a redirected URL.

## Decision

- `titleCount` counts only `<title>` elements in the HTML namespace, in the head and body.
  The page title (`title`) is taken from the first of those same elements, so an SVG title is
  never reported as the page title either.
- `metaDescriptionCount` counts every `<meta name="description">` (name compared
  case-insensitively), empty ones included; the stored `metaDescription` is unchanged.
- `metaRefresh` is the trimmed `content` of the first `<meta http-equiv="refresh">`
  (attribute value compared case-insensitively) with non-empty content; `None` otherwise.
- `paginationNext` / `paginationPrev` are the first `link[rel~=next]` / `link[rel~=prev]`
  with a resolvable `href` inside `<head>`, resolved to absolute URLs without fragment.
  Same-host targets are queued like internal links (so they also count as linked for orphan
  detection) but do not change `internalLinkCount`.
- `paginationTargetError` flags a page when either target is missing from the crawled pages
  (another host, or beyond depth/page limits), answered a status other than 200, or has a
  non-empty redirect chain (a redirect is not a 200 target even though its final status is).
- All four issues are `warn`. Titles and meta descriptions sit in their existing Overview
  sections; meta refresh and pagination sit under "Canonical & Indexing".

## Consequences

- Old saved crawls load with counts of 0 and null values, so none of the new issues fire on
  them.
- During a live crawl a pagination target that is queued but not yet fetched is briefly
  reported as not crawled, like the existing orphan check.
- A rel=next/prev target on another host is always reported, since it is never crawled.
