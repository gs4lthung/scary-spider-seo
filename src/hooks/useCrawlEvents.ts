import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { type EventBatcher, createEventBatcher } from "@/lib/eventBatcher";
import type { CrawlProgress, CrawlSummary, PageResult, ResourceResult, SiteInfo } from "@/types";

/** How long page, resource and progress events are buffered before one state update applies them. */
const FLUSH_DELAY_MS = 150;

type BufferedEvent =
  | { kind: "page"; page: PageResult }
  | { kind: "resource"; resource: ResourceResult }
  // The payload itself lives in `pendingProgressRef`: only the latest one matters.
  | { kind: "progress" };

type Setter<T> = Dispatch<SetStateAction<T>>;

export interface CrawlEventSetters {
  setPages: Setter<PageResult[]>;
  setResources: Setter<ResourceResult[]>;
  setSiteInfo: Setter<SiteInfo | null>;
  setProgress: Setter<CrawlProgress | null>;
  setPaused: Setter<boolean>;
  setRunning: Setter<boolean>;
  setLinkedUrls: Setter<string[]>;
  setResumableStartUrl: Setter<string | null>;
  /** Start URL of whichever crawl most recently started, read by the `crawl://done` listener. */
  activeStartUrlRef: RefObject<string | null>;
}

/**
 * Registers the six `crawl://*` listeners once on mount. Pages, resources and progress are
 * buffered and applied in one batch per flush window (progress keeps only its latest value);
 * the other events update state directly. Returns `discardPending`, which drops buffered
 * events that were not applied yet (used when a new crawl clears the view), and
 * `discardPendingProgress`, which drops only a buffered progress update (used before an
 * optimistic pause or resume, so a pre-click payload cannot undo it).
 */
export function useCrawlEvents({
  setPages,
  setResources,
  setSiteInfo,
  setProgress,
  setPaused,
  setRunning,
  setLinkedUrls,
  setResumableStartUrl,
  activeStartUrlRef,
}: CrawlEventSetters): { discardPending: () => void; discardPendingProgress: () => void } {
  const batcherRef = useRef<EventBatcher<BufferedEvent> | null>(null);
  const pendingProgressRef = useRef<CrawlProgress | null>(null);

  useEffect(() => {
    // `listen()`/unlisten are async, and React StrictMode's dev-only
    // mount->unmount->remount cycle can leave a stale listener from the first
    // mount briefly registered alongside the second mount's listener before its
    // unlisten call resolves. Without this guard, events fired in that overlap
    // window get processed twice (e.g. duplicate rows for the same page).
    let active = true;
    const unlistenFns: Array<() => void> = [];

    // Pages, resources and progress share one batcher so they land in the same flush, as one render.
    const batcher = createEventBatcher<BufferedEvent>((events) => {
      const pageBatch: PageResult[] = [];
      const resourceBatch: ResourceResult[] = [];
      for (const e of events) {
        if (e.kind === "page") pageBatch.push(e.page);
        else if (e.kind === "resource") resourceBatch.push(e.resource);
      }
      if (pageBatch.length > 0) setPages((prev) => [...prev, ...pageBatch]);
      if (resourceBatch.length > 0) setResources((prev) => [...prev, ...resourceBatch]);
      const progress = pendingProgressRef.current;
      pendingProgressRef.current = null;
      if (progress) {
        setProgress(progress);
        setPaused(progress.paused);
      }
    }, FLUSH_DELAY_MS);
    batcherRef.current = batcher;

    async function registerListener<T>(event: string, handler: (payload: T) => void) {
      const unlisten = await listen<T>(event, (e) => {
        if (!active) return;
        handler(e.payload);
      });
      if (!active) {
        unlisten();
        return;
      }
      unlistenFns.push(unlisten);
    }

    (async () => {
      await registerListener<PageResult>("crawl://page", (payload) => {
        batcher.push({ kind: "page", page: payload });
      });
      await registerListener<ResourceResult>("crawl://resource", (payload) => {
        batcher.push({ kind: "resource", resource: payload });
      });
      await registerListener<SiteInfo>("crawl://site_info", (payload) => {
        setSiteInfo(payload);
      });
      await registerListener<CrawlProgress>("crawl://progress", (payload) => {
        pendingProgressRef.current = payload;
        batcher.push({ kind: "progress" });
      });
      await registerListener<CrawlSummary>("crawl://done", (payload) => {
        setRunning(false);
        setPaused(false);
        setLinkedUrls(payload.linkedUrls);
        // The backend sends a final progress right before `done`; it may still be buffered.
        const finalProgress = pendingProgressRef.current;
        pendingProgressRef.current = null;
        setProgress((prev) => {
          const latest = finalProgress ?? prev;
          return latest ? { ...latest, running: false, paused: false } : latest;
        });
        setResumableStartUrl(payload.resumable ? activeStartUrlRef.current : null);
      });
      await registerListener<string>("crawl://error", (payload) => {
        toast.error(payload);
        setRunning(false);
      });
    })();

    return () => {
      active = false;
      batcher.cancel();
      pendingProgressRef.current = null;
      if (batcherRef.current === batcher) batcherRef.current = null;
      unlistenFns.forEach((fn) => fn());
    };
    // All dependencies are state setters and a ref, stable for the component's lifetime, so
    // the listeners are registered once on mount.
  }, [
    setPages,
    setResources,
    setSiteInfo,
    setProgress,
    setPaused,
    setRunning,
    setLinkedUrls,
    setResumableStartUrl,
    activeStartUrlRef,
  ]);

  const discardPending = useCallback(() => {
    batcherRef.current?.cancel();
    pendingProgressRef.current = null;
  }, []);
  const discardPendingProgress = useCallback(() => {
    pendingProgressRef.current = null;
  }, []);
  return { discardPending, discardPendingProgress };
}
