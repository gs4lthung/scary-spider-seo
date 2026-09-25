# ADR-0004: Title, meta description and H1 length audit details (T1.3)

## Context

T1.3 adds eight issues (`titleOverPixels`, `titleUnderPixels`, `metaTooLong`, `metaTooShort`,
`metaOverPixels`, `metaUnderPixels`, `titleSameAsH1`, `h1TooLong`) and a pixel-width
estimator. The plan fixes the thresholds, the font sizes and the width table's origin. It is
silent on a few details.

## Decision

1. **Width table source.** Arial is metric-compatible with Helvetica, so the table uses the
   Helvetica advance widths from Adobe's Core 14 AFM metrics (1000 units per em) for ASCII
   32..126. ASCII `'` and `` ` `` use Arial's `quotesingle` (191) and `grave` (333), not the
   AFM `quoteright`/`quoteleft` glyphs. Widths are rounded to whole pixels.
2. **Unknown characters** (anything outside ASCII 32..126, counted per code point, not per
   UTF-16 unit) use the mean of the table (about 527 units).
3. **Missing values are not also flagged as short.** Every title and meta check requires the
   title or description to be present; missing ones are already `missingTitle` and
   `missingMeta`. `titleSameAsH1` also requires a non-empty H1.
4. **Character lengths** for meta checks reuse the crawler's `metaDescriptionLength`
   (Unicode scalar count). `h1TooLong` counts code points of the trimmed first H1, the only H1
   text the crawler stores.
5. **Boundaries are strict**, like Screaming Frog's "Over"/"Below" filters: exactly 561 px,
   155 characters, 985 px or 70 characters is not flagged, and neither is exactly 200 px,
   70 characters or 400 px on the low side.
6. **Placement and tone.** Title pixel checks and `titleSameAsH1` go in the Overview "Titles"
   section next to the character-length checks; meta checks and `h1TooLong` go in "Content"
   next to the existing meta and H1 rows. All are neutral (no tone), matching the existing
   title-length rows, because they are optimisation hints rather than defects.
7. **Pixel widths are cached per page object** (`WeakMap`) and exported as
   `getTitlePixelWidth`/`getMetaPixelWidth`, so the predicates, the "Title px"/"Meta px"
   columns and the detail view share one computation. The detail view also lists both widths.

## Consequences

- The estimate is close to Google's rendering for Latin text but not exact (kerning, bold
  query terms and non-Latin scripts are not modelled); the solutions say so.
- CJK titles are under-estimated, since their glyphs are wider than the ASCII average.
- No saved-crawl format change: everything is derived from existing fields.
