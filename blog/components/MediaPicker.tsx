"use client";

import { useEffect, useState } from "react";
import { listMediaImages, type MediaItem } from "@/app/admin/media-actions";

// Compact grid of uploaded images used inside the post editor ("from
// library"); clicking an image calls onSelect with its /media/<key> path.
export function MediaPicker({ onSelect }: { onSelect: (key: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await listMediaImages({});
        if (cancelled) return;
        setItems(res.items);
        setCursor(res.cursor);
      } catch {
        if (!cancelled) setError("Failed to load images.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    if (loading || !cursor) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listMediaImages({ cursor });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.cursor);
    } catch {
      setError("Failed to load more images.");
    } finally {
      setLoading(false);
    }
  }

  if (loading && items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Loading images...</p>;
  }
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">{error ?? "No images uploaded yet."}</p>;
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto p-4">
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(`/media/${item.key}`)}
            title={`${item.name}\n${item.key}`}
            className="block overflow-hidden rounded border border-border transition hover:border-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/media/${item.key}`} alt="" className="aspect-square w-full object-cover" />
            <span className="block truncate border-t border-border px-1.5 py-1 text-left text-xs text-muted-foreground">
              {item.name}
            </span>
          </button>
        ))}
      </div>
      {cursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-4 w-full rounded border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </div>
  );
}