/**
 * Estimated rendered width of SERP text, used for Screaming Frog style pixel-width checks.
 *
 * Google renders result titles and snippets in Arial. Arial is metric-compatible with
 * Helvetica, so the advance widths below are Helvetica's, in 1000 units per em, taken from
 * Adobe's Core 14 AFM metrics (Helvetica.afm, "WX" values) for ASCII 32..126. Code 39 uses
 * `quotesingle` (191) and code 96 uses `grave` (333), which is what Arial maps those ASCII
 * code points to. Width in pixels = sum of advances * font size / 1000.
 */

/** Google SERP title font size in pixels. */
export const TITLE_FONT_PX = 20;
/** Google SERP description (snippet) font size in pixels. */
export const META_FONT_PX = 14;

const FIRST_CODE = 32;

const ADVANCE_WIDTHS: readonly number[] = [
  // space ! " # $ % & ' ( ) * + , - . /
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  // 0-9
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  // : ; < = > ? @
  278, 278, 584, 584, 584, 556, 1015,
  // A-Z
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  // [ \ ] ^ _ `
  278, 278, 278, 469, 556, 333,
  // a-z
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833,
  556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  // { | } ~
  334, 260, 334, 584,
];

/** Width used for any character outside the table (non-ASCII, control characters). */
const AVERAGE_ADVANCE = ADVANCE_WIDTHS.reduce((sum, w) => sum + w, 0) / ADVANCE_WIDTHS.length;

function advanceWidth(codePoint: number): number {
  return ADVANCE_WIDTHS[codePoint - FIRST_CODE] ?? AVERAGE_ADVANCE;
}

/** Estimated width of `text` in Arial at `fontPx`, rounded to whole pixels. */
export function estimatePixelWidth(text: string, fontPx: number): number {
  let units = 0;
  for (const ch of text) {
    units += advanceWidth(ch.codePointAt(0) ?? 0);
  }
  return Math.round((units * fontPx) / 1000);
}
