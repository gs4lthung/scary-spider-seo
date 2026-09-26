/**
 * Hreflang code validation. Google accepts an ISO 639-1 language code, optionally followed by
 * an ISO 3166-1 alpha-2 region code, or the special value `x-default`. Codes compare
 * case-insensitively. See ADR-0013 for how the code sets are generated.
 */
import { ISO_LANGUAGES, ISO_REGIONS } from "./isoCodes";

export const X_DEFAULT = "x-default";

const HREFLANG_SHAPE = /^([a-z]{2})(?:-([a-z]{2}))?$/i;

/** Whether `lang` is the `x-default` fallback annotation (any case). */
export function isXDefault(lang: string): boolean {
  return lang.trim().toLowerCase() === X_DEFAULT;
}

/** Whether `code` is `x-default`, a known language, or a known language plus a known region. */
export function isValidHreflang(code: string): boolean {
  if (isXDefault(code)) return true;
  const match = HREFLANG_SHAPE.exec(code.trim());
  if (!match) return false;
  const [, language, region] = match;
  if (!ISO_LANGUAGES.has(language.toLowerCase())) return false;
  return region === undefined || ISO_REGIONS.has(region.toUpperCase());
}
