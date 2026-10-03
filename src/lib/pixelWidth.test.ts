import { describe, expect, it } from "vitest";
import { META_FONT_PX, TITLE_FONT_PX, estimatePixelWidth } from "./pixelWidth";

describe("estimatePixelWidth", () => {
  it("empty string is zero", () => {
    expect(estimatePixelWidth("", TITLE_FONT_PX)).toBe(0);
  });

  it("wider glyphs measure wider than narrow ones", () => {
    expect(estimatePixelWidth("WWW", TITLE_FONT_PX)).toBeGreaterThan(estimatePixelWidth("iii", TITLE_FONT_PX));
  });

  it("a 60 character typical title lands between 450 and 600 px", () => {
    const title = "Best Hiking Boots for Beginners in 2026: Reviews and Buying.";
    expect(title).toHaveLength(60);
    const width = estimatePixelWidth(title, TITLE_FONT_PX);
    expect(width).toBeGreaterThan(450);
    expect(width).toBeLessThan(600);
  });

  it("scales linearly with font size", () => {
    // "W" is 944 units: 18.88 px at 20 px and 13.216 px at 14 px.
    expect(estimatePixelWidth("W", TITLE_FONT_PX)).toBe(19);
    expect(estimatePixelWidth("W", META_FONT_PX)).toBe(13);
  });

  it("measures characters outside the table at the average width", () => {
    const unknown = estimatePixelWidth("éééééééééé", TITLE_FONT_PX);
    expect(unknown).toBeGreaterThan(estimatePixelWidth("iiiiiiiiii", TITLE_FONT_PX));
    expect(unknown).toBeLessThan(estimatePixelWidth("WWWWWWWWWW", TITLE_FONT_PX));
  });

  it("counts an astral character once, not per UTF-16 code unit", () => {
    expect(estimatePixelWidth("\u{1F600}", TITLE_FONT_PX)).toBe(estimatePixelWidth("é", TITLE_FONT_PX));
  });
});
