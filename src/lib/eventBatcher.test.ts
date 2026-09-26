import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEventBatcher } from "./eventBatcher";

describe("createEventBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes once per delay window", () => {
    const flush = vi.fn();
    const batcher = createEventBatcher<number>(flush, 150);
    batcher.push(1);
    vi.advanceTimersByTime(100);
    batcher.push(2);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenLastCalledWith([1, 2]);

    batcher.push(3);
    vi.advanceTimersByTime(149);
    expect(flush).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenLastCalledWith([3]);

    // Nothing pushed: no empty flush.
    vi.advanceTimersByTime(1000);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("preserves order across pushes", () => {
    const flushed: string[][] = [];
    const batcher = createEventBatcher<string>((items) => flushed.push(items), 150);
    const first = ["a", "b", "c", "d"];
    const second = ["e", "f"];
    first.forEach((item) => batcher.push(item));
    vi.advanceTimersByTime(150);
    second.forEach((item) => batcher.push(item));
    vi.advanceTimersByTime(150);
    expect(flushed).toEqual([first, second]);
  });

  it("cancel drops pending items", () => {
    const flush = vi.fn();
    const batcher = createEventBatcher<number>(flush, 150);
    batcher.push(1);
    batcher.push(2);
    batcher.cancel();
    vi.advanceTimersByTime(1000);
    expect(flush).not.toHaveBeenCalled();

    // Still usable after a cancel.
    batcher.push(3);
    vi.advanceTimersByTime(150);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenLastCalledWith([3]);
  });
});
