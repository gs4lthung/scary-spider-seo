/** Prepends `https://` or `http://` (per `preferHttps`) to a URL that has no scheme —
 * leaving a URL that already specifies one untouched, since the checkbox is only a
 * fallback for what to assume when the user didn't type a scheme themselves. */
export function withScheme(url: string, preferHttps: boolean): string {
  const trimmed = url.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `${preferHttps ? "https" : "http"}://${trimmed}`;
}
