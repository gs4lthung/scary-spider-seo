#!/usr/bin/env node
// Generates src/lib/isoCodes.ts: the ISO 639-1 language codes and ISO 3166-1
// alpha-2 region codes that hreflang validation accepts.
//
// The lists are derived from the ICU data bundled with Node (Intl.DisplayNames)
// instead of being typed by hand: every two-letter pair aa..zz is kept when ICU
// has a display name for it. Region codes that ICU knows but ISO 3166-1 does not
// assign to a country (macro-regions, private-use and exceptionally reserved
// codes) are excluded explicitly below, and deprecated aliases are dropped.
//
// Usage: node scripts/gen-iso-codes.mjs   (then commit src/lib/isoCodes.ts)
// See docs/decisions/ADR-0013-generated-iso-code-lists.md.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../src/lib/isoCodes.ts", import.meta.url));

// Known to ICU but not an officially assigned ISO 3166-1 alpha-2 country code.
const NON_COUNTRY_REGIONS = new Set([
  "AC", "CP", "CQ", "DG", "EA", "EU", "EZ", "IC", "TA", "UN", "QO", "XA", "XB", "XK", "ZZ",
]);

const letters = "abcdefghijklmnopqrstuvwxyz".split("");
const pairs = letters.flatMap((a) => letters.map((b) => a + b));

const languageNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
const regionNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });

// Deprecated aliases (iw, UK, ...) have display names too; keep only codes that
// are already their own canonical form.
const isCanonical = (subtags, code) => Intl.getCanonicalLocales(subtags)[0].endsWith(code);

const languages = pairs
  .filter((code) => isCanonical(code, code) && languageNames.of(code) !== undefined)
  .sort();
const regions = pairs
  .map((code) => code.toUpperCase())
  .filter(
    (code) =>
      !NON_COUNTRY_REGIONS.has(code) &&
      isCanonical(`und-${code}`, code) &&
      regionNames.of(code) !== undefined,
  )
  .sort();

const source = `// GENERATED FILE, do not edit by hand.
// Regenerate with: node scripts/gen-iso-codes.mjs
// Source: ICU data bundled with Node ${process.version} (Intl.DisplayNames).

/** ISO 639-1 two-letter language codes, lowercase. */
export const ISO_LANGUAGES: ReadonlySet<string> = new Set(
  "${languages.join(" ")}".split(" "),
);

/** ISO 3166-1 alpha-2 region codes, uppercase. */
export const ISO_REGIONS: ReadonlySet<string> = new Set(
  "${regions.join(" ")}".split(" "),
);
`;

writeFileSync(OUT, source);
console.log(JSON.stringify({ out: OUT, languages: languages.length, regions: regions.length }));
