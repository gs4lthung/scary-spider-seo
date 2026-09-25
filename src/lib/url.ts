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
