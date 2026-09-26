/**
 * Buffers items that arrive at a high rate (Tauri crawl events) and hands them to `flush`
 * in one array at most once per `delayMs`, so the UI renders once per window instead of
 * once per event. The window starts at the first push after a flush; items keep their
 * push order. `cancel` drops anything pending without flushing it.
 */
export interface EventBatcher<T> {
  push: (item: T) => void;
  cancel: () => void;
}

export function createEventBatcher<T>(flush: (items: T[]) => void, delayMs: number): EventBatcher<T> {
  let pending: T[] = [];
  let handle: ReturnType<typeof setTimeout> | undefined;

  function push(item: T) {
    pending.push(item);
    if (handle !== undefined) return;
    handle = setTimeout(() => {
      handle = undefined;
      const items = pending;
      pending = [];
      if (items.length > 0) flush(items);
    }, delayMs);
  }

  function cancel() {
    if (handle !== undefined) clearTimeout(handle);
    handle = undefined;
    pending = [];
  }

  return { push, cancel };
}
