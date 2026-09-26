/**
 * Hreflang code validation. Google accepts an ISO 639-1 language code, optionally followed by
 * an ISO 15924 script code and then an ISO 3166-1 alpha-2 region code (`zh-Hant`,
 * `zh-Hans-US`, `en-GB`), or the special value `x-default`. Codes compare case-insensitively. See ADR-0013 for how the code sets are generated.
 */
import { ISO_LANGUAGES, ISO_REGIONS, ISO_SCRIPTS } from "./isoCodes";

export const X_DEFAULT = "x-default";

const HREFLANG_SHAPE = /^([a-z]{2})(?:-([a-z]{4}))?(?:-([a-z]{2}))?$/i;

const titleCase = (code: string) => code[0].toUpperCase() + code.slice(1).toLowerCase();

/** Whether `lang` is the `x-default` fallback annotation (any case). */
export function isXDefault(lang: string): boolean {
  return lang.trim().toLowerCase() === X_DEFAULT;
}

/** Whether `code` is `x-default`, or a known language optionally followed by a known script
 * and then a known region. */
export function isValidHreflang(code: string): boolean {
  if (isXDefault(code)) return true;
  const match = HREFLANG_SHAPE.exec(code.trim());
  if (!match) return false;
  const [, language, script, region] = match;
  if (!ISO_LANGUAGES.has(language.toLowerCase())) return false;
  if (script !== undefined && !ISO_SCRIPTS.has(titleCase(script))) return false;
  return region === undefined || ISO_REGIONS.has(region.toUpperCase());
}
