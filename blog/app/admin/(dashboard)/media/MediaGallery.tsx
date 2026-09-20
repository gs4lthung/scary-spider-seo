"use client";

import { useState } from "react";
import { deleteMediaImage, listMediaImages, type MediaItem } from "@/app/admin/media-actions";
import { useToast } from "@/components/Toaster";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mediaUrl(key: string) {
  return new URL(`/media/${key}`, window.location.origin).toString();
}

function formatUploaded(value: string | null) {
  if (!value) return "Upload time unavailable";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MediaGallery({
  initialItems,
  initialCursor,
}: {
  initialItems: MediaItem[];
  initialCursor: string | null;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function copyUrl(key: string) {
    try {
      await navigator.clipboard.writeText(mediaUrl(key));
      setCopiedKey(key);
      toast("URL copied");
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
    } catch {
      toast("Failed to copy the URL.", "error");
    }
  }

  async function remove(key: string) {
    if (deletingKey) return;
    if (!window.confirm("Delete this image? This cannot be undone.")) return;
    setDeletingKey(key);
    setError(null);
    try {
      const res = await deleteMediaImage(key);
      if (!res.ok) {
        toast(res.error ?? "Failed to delete the image.", "error");
        return;
      }
      setItems((prev) => prev.filter((item) => item.key !== key));
      if (preview?.key === key) setPreview(null);
      toast("Image deleted");
    } catch {
      toast("Failed to delete the image.", "error");
    } finally {
      setDeletingKey(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No images uploaded yet. Add one from a post&apos;s cover image or the editor.
      </p>
    );
  }

  return (
    <div>
      {error ? <p className="mb-4 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.key} className="overflow-hidden rounded-lg border border-border bg-card">
            <button type="button" onClick={() => setPreview(item)} className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/media/${item.key}`} alt="" className="aspect-video w-full object-cover" />
            </button>
            <div className="flex items-center justify-between gap-2 p-2">
              <div className="min-w-0">
                <a
                  href={mediaUrl(item.key)}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs font-medium hover:text-primary hover:underline"
                  title={mediaUrl(item.key)}
                >
                  {item.name}
                </a>
                <p className="truncate text-[11px] text-muted-foreground" title={mediaUrl(item.key)}>
                  {mediaUrl(item.key)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(item.size)} · {formatUploaded(item.uploaded)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copyUrl(item.key)}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
                >
                  {copiedKey === item.key ? "Copied" : "Copy URL"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.key)}
                  disabled={deletingKey === item.key}
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingKey === item.key ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-6 rounded border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      ) : null}

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
        >
          <div onClick={(e) => e.stopPropagation()} className="max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/media/${preview.key}`} alt="" className="max-h-[80vh] max-w-full rounded-lg shadow-xl" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="truncate font-mono text-xs text-white/80">
                <a
                  href={mediaUrl(preview.key)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:text-white hover:underline"
                >
                  {mediaUrl(preview.key)}
                </a>
                <span> · {formatUploaded(preview.uploaded)}</span>
              </span>
              <button
                type="button"
                onClick={() => copyUrl(preview.key)}
                className="rounded bg-white/90 px-3 py-1.5 text-sm font-medium text-black hover:bg-white"
              >
                {copiedKey === preview.key ? "Copied" : "Copy URL"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
