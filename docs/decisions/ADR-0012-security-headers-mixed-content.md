# ADR-0012: Security headers and mixed content

Status: accepted (T2.5)

## Context

T2.5 adds `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` and
`Referrer-Policy` as raw `Option<String>` fields on `PageResult`, a `mixed_content_count`, and
five issues (`missingCsp`, `missingFrameOptions`, `missingContentTypeOptions`,
`missingReferrerPolicy`, `mixedContent`). The plan leaves open:

- How a crawl saved before T2.5 is treated. Serde defaults the new header fields to `None`,
  which is indistinguishable from "header not sent", so every HTML page of an old crawl would
  be reported as missing all four headers.
- Which pages the header checks apply to (all URLs, HTML only, HTTPS only).
- What value `X-Content-Type-Options` must have, and how CSP `frame-ancestors` is detected.
- Which `<link>` elements count as stylesheets for mixed content.

## Decision

- **Old crawls.** Add `security_headers_captured: bool` (`#[serde(default)]`, so false for old
  saves and for fetch errors that never produced a response). `fetch_and_parse` sets it true on
  every result built from a response, including the non-HTML `base` result. The four header
  checks only fire when it is true.
- **Scope.** The four header checks apply to HTML pages (`htmlSizeBytes > 0`) on any scheme,
  matching Screaming Frog, which reports them regardless of HTTPS. Non-HTML URLs are skipped
  because these headers protect documents, and flagging every PDF or feed would be noise.
  `mixedContent` applies to `https:` pages only, as the plan says.
- **Values.** `missingContentTypeOptions` fires unless the header equals `nosniff`
  (case-insensitive, trimmed), the only valid value. `missingFrameOptions` is satisfied by any
  non-blank `X-Frame-Options` or a CSP containing a `frame-ancestors` directive (matched at the
  start of a directive, case-insensitive). A blank CSP or Referrer-Policy counts as missing.
  `Content-Security-Policy-Report-Only` is not read: it enforces nothing.
- **Mixed content** counts `script[src]`, `link[rel~=stylesheet i][href]`, `iframe[src]`,
  `video[src]`, `audio[src]` and `source[src]` that resolve to `http:`, counted before
  `parse_page` strips `<script>` subtrees. Images stay under the existing `insecureLinks` check.
  `rel` is matched as a token list so `rel="preload stylesheet"` counts.
- **UI.** The plan lists no view changes, so the header values reach the user through the
  Overview issue tiles, issue detail, and new CSV columns; no Pages table column is added.

## Consequences

- Reopening an old crawl shows no security header issues until the site is re-crawled.
- One extra boolean per page in the event payload and the saved file.
- With JS rendering on, the headers come from the initial `HEAD` response, like `hsts`.
