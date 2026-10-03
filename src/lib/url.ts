/** Prepends `https://` or `http://` (per `preferHttps`) to a URL that has no scheme —
 * leaving a URL that already specifies one untouched, since the checkbox is only a
 * fallback for what to assume when the user didn't type a scheme themselves. */
export function withScheme(url: string, preferHttps: boolean): string {
  const trimmed = url.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `${preferHttps ? "https" : "http"}://${trimmed}`;
}

/** A crawled URL made readable: percent-encoded UTF-8 (e.g. `caf%C3%A9`) is shown as the
 * characters it encodes. Reserved characters stay escaped (`decodeURI` semantics), and a
 * malformed escape leaves the URL as stored. Display only; never use the result to fetch. */
export function decodeUrlForDisplay(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

/** Most URLs a list-mode crawl accepts (matches `MAX_LIST_URLS` in the Rust crawler). */
export const MAX_LIST_URLS = 50_000;

export interface ParsedUrlList {
  /** Absolute http(s) URLs in paste order, without fragments, each listed once. */
  valid: string[];
  /** Trimmed non-blank lines that are not absolute http(s) URLs, in paste order. */
  invalid: string[];
}

/** Parses a pasted list of URLs, one per line, for list mode. Lines are trimmed and blank
 * ones skipped. A line must be an absolute http:// or https:// URL; anything else is
 * reported as invalid. Duplicates (compared without the fragment, the way the crawler
 * dedups) are dropped, keeping the first. */
export function parseUrlList(text: string): ParsedUrlList {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const url = parseHttpUrl(line);
    if (!url) {
      invalid.push(line);
      continue;
    }
    url.hash = "";
    const key = url.href;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(key);
  }
  return { valid, invalid };
}

function parseHttpUrl(line: string): URL | null {
  if (!/^https?:\/\//i.test(line)) return null;
  try {
    const url = new URL(line);
    return url.hostname ? url : null;
  } catch {
    return null;
  }
}
