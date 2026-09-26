import { describe, expect, it } from "vitest";
import { bestTimeMs } from "./testTiming";
import type { PageResult } from "../types";
import {
  createNearDuplicateTracker,
  findNearDuplicates,
  getNearDuplicateClusters,
  ingestNearDuplicatePage,
  isNearDuplicateCandidate,
  simhashDistance,
} from "./nearDuplicates";

// Detection only reads these fields, so the rest of PageResult is left out.
function page(path: string, contentSimhash: string, overrides: Partial<PageResult> = {}): PageResult {
  return {
    url: `https://example.com/${path}`,
    contentSimhash,
    contentHash: `hash-${path}`,
    htmlSizeBytes: 1000,
    status: 200,
    redirectChain: [],
    indexability: "Indexable",
    ...overrides,
  } as unknown as PageResult;
}

/** `base` with the lowest `bits` bits flipped. */
function flip(base: bigint, bits: number): string {
  const mask = (1n << BigInt(bits)) - 1n;
  return (base ^ mask).toString(16).padStart(16, "0");
}

const BASE = 0x0123_4567_89ab_cdefn;
const hex = (n: bigint) => n.toString(16).padStart(16, "0");

describe("simhashDistance", () => {
  it("counts differing bits across both halves", () => {
    expect(simhashDistance(hex(BASE), hex(BASE))).toBe(0);
    expect(simhashDistance(hex(BASE), flip(BASE, 3))).toBe(3);
    expect(simhashDistance("ffffffffffffffff", "0000000000000000")).toBe(64);
    expect(simhashDistance("8000000000000001", "0000000000000000")).toBe(2);
  });
});

describe("findNearDuplicates", () => {
  it("finds pairs within distance 3", () => {
    const clusters = findNearDuplicates([
      page("a", hex(BASE)),
      page("b", flip(BASE, 3)),
      page("c", hex(BASE ^ 0xffff_0000_0000_0000n)),
    ]);
    expect(clusters.get("https://example.com/a")).toBeDefined();
    expect(clusters.get("https://example.com/a")).toBe(clusters.get("https://example.com/b"));
    expect(clusters.has("https://example.com/c")).toBe(false);
  });

  it("finds pairs whose differing bits span every band", () => {
    // One bit flipped in three different bands: only the fourth band matches.
    const spread = BASE ^ 0x0001_0000_0001_0001n;
    const clusters = findNearDuplicates([page("a", hex(BASE)), page("b", hex(spread))]);
    expect(clusters.size).toBe(2);
  });

  it("ignores pairs at distance 10", () => {
    const clusters = findNearDuplicates([page("a", hex(BASE)), page("b", flip(BASE, 10))]);
    expect(clusters.size).toBe(0);
  });

  it("ignores pairs at distance 4", () => {
    const clusters = findNearDuplicates([page("a", hex(BASE)), page("b", flip(BASE, 4))]);
    expect(clusters.size).toBe(0);
  });

  it("chains near duplicates into one cluster and separates unrelated clusters", () => {
    const other = 0x7777_0000_ffff_1111n;
    const clusters = findNearDuplicates([
      page("a", hex(BASE)),
      page("b", flip(BASE, 3)),
      // Distance 3 from b, 6 from a: joined through b.
      page("c", hex(BASE ^ 0x3fn)),
      page("x", hex(other)),
      page("y", hex(other ^ 1n)),
    ]);
    const a = clusters.get("https://example.com/a");
    expect(clusters.get("https://example.com/c")).toBe(a);
    expect(clusters.get("https://example.com/x")).toBe(clusters.get("https://example.com/y"));
    expect(clusters.get("https://example.com/x")).not.toBe(a);
  });

  it("does not pair exact duplicates", () => {
    const clusters = findNearDuplicates([
      page("a", hex(BASE), { contentHash: "same" }),
      page("b", hex(BASE), { contentHash: "same" }),
    ]);
    expect(clusters.size).toBe(0);
  });

  it("pairs equal fingerprints with different content hashes", () => {
    const clusters = findNearDuplicates([
      page("a", hex(BASE), { contentHash: "one" }),
      page("b", hex(BASE), { contentHash: "one" }),
      page("c", hex(BASE), { contentHash: "two" }),
    ]);
    expect(clusters.size).toBe(3);
  });

  it("counts exact copies in the cluster size", () => {
    const tracker = createNearDuplicateTracker();
    for (const p of [
      page("a", hex(BASE), { contentHash: "same" }),
      page("b", hex(BASE), { contentHash: "same" }),
      page("c", flip(BASE, 2)),
    ]) {
      ingestNearDuplicatePage(tracker, p);
    }
    const clusters = getNearDuplicateClusters(tracker);
    expect(clusters.get("https://example.com/c")?.size).toBe(3);
  });

  it("skips pages without a fingerprint, redirected, non-200, non-HTML or non-indexable pages", () => {
    const near = flip(BASE, 1);
    const skipped = [
      page("empty", ""),
      page("bad-hex", "not-a-simhash!!!"),
      page("redirected", near, { redirectChain: ["https://example.com/r"] }),
      page("error", near, { status: 404 }),
      page("non-html", near, { htmlSizeBytes: 0 }),
      page("canonicalised", near, { indexability: "Canonicalised" }),
    ];
    for (const p of skipped) expect(isNearDuplicateCandidate(p)).toBe(false);
    expect(findNearDuplicates([page("a", hex(BASE)), ...skipped]).size).toBe(0);
  });

  it("gives the same result when pages arrive one batch at a time", () => {
    const pages = [page("a", hex(BASE)), page("x", hex(0x7777n)), page("b", flip(BASE, 2))];
    const tracker = createNearDuplicateTracker();
    ingestNearDuplicatePage(tracker, pages[0]);
    ingestNearDuplicatePage(tracker, pages[1]);
    expect(getNearDuplicateClusters(tracker).size).toBe(0);
    ingestNearDuplicatePage(tracker, pages[2]);
    expect([...getNearDuplicateClusters(tracker).keys()].sort()).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("rejects a distance the banding cannot guarantee", () => {
    expect(() => findNearDuplicates([], 4)).toThrow(RangeError);
  });

  it("handles 20k pages under 1 s", () => {
    const count = 20_000;
    const pages: PageResult[] = [];
    // Deterministic pseudo-random fingerprints (xorshift64), with every 10th page a near copy
    // of the one before it.
    let state = 0x9e37_79b9_7f4a_7c15n;
    const next = () => {
      state ^= (state << 13n) & 0xffff_ffff_ffff_ffffn;
      state ^= state >> 7n;
      state ^= (state << 17n) & 0xffff_ffff_ffff_ffffn;
      return state;
    };
    let previous = 0n;
    for (let i = 0; i < count; i++) {
      const value = i % 10 === 9 ? previous ^ 0b101n : next();
      pages.push(page(`p${i}`, hex(value)));
      previous = value;
    }
    const run = () => findNearDuplicates(pages);
    // An untimed warm-up pass lets the JIT compile the hot loops. Timed passes measure CPU time
    // (see bestTimeMs), not wall-clock, because parallel Vitest workers and cargo can deschedule
    // this process; passes repeat for a bounded window and the best one must fit the budget.
    expect(run().size).toBe((count / 10) * 2);
    expect(bestTimeMs(run, 1000)).toBeLessThan(1000);
  }, 60_000);
});
