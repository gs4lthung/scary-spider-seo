"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { requirePermission, requireUser } from "@/lib/authz";

type ListedMediaObject = {
  key: string;
  customMetadata?: Record<string, string>;
  size: number;
  uploaded?: Date;
  httpMetadata?: { contentType?: string };
};

function isMediaKey(key: string): boolean {
  return /^[0-9a-f-]{36}\.(png|jpe?g|webp|gif|avif)$/i.test(key);
}

// Uploads are not a server action: they go through the /admin/upload route
// handler (app/admin/upload/route.ts, lib/media-upload.ts) to stay clear of
// Cloudflare's managed WAF rule for server action bodies.

// Best-effort R2 cleanup for images no longer referenced by any post
// (called from posts-actions.ts on update/delete). Never throws: a failed
// delete just leaves an orphaned object in R2, which is harmless, rather
// than blocking the post save/delete itself.
export async function deleteMediaKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await requirePermission("posts:write");
  const safeKeys = keys.filter(isMediaKey);
  if (safeKeys.length === 0) return;
  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.MEDIA.delete(safeKeys);
  } catch (err) {
    console.error("Failed to delete media keys from R2", keys, err);
  }
}

export type MediaItem = {
  key: string;
  name: string;
  size: number;
  uploaded: string | null;
  contentType: string | null;
};

// Lists uploaded images for the /admin/media library and the editor's
// "from library" picker. R2 pages lexicographically by key, so each page is
// sorted newest-first by upload time for display.
export async function listMediaImages(options?: {
  cursor?: string;
  limit?: number;
}): Promise<{ items: MediaItem[]; cursor: string | null }> {
  await requireUser();
  const { env } = await getCloudflareContext({ async: true });
  const listed = await env.MEDIA.list({
    limit: options?.limit ?? 60,
    cursor: options?.cursor,
  });

  const objects = listed.objects as ListedMediaObject[];
  const items = objects
    .filter((object: ListedMediaObject) => /\.(webp|png|jpe?g|gif|avif)$/i.test(object.key))
    .map((object: ListedMediaObject) => ({
      key: object.key,
      name: object.customMetadata?.name || object.key,
      size: object.size,
      uploaded: object.uploaded?.toISOString() ?? null,
      contentType: object.httpMetadata?.contentType ?? null,
    }))
    .sort((a, b) => (b.uploaded ?? "").localeCompare(a.uploaded ?? ""));

  return { items, cursor: listed.truncated ? listed.cursor : null };
}

// Deletes a single image from R2, refusing when any post still references it
// (in its body content or as the cover image). Best-effort error reporting;
// never throws.
export async function deleteMediaImage(key: string): Promise<{ ok: boolean; error?: string }> {
  await requirePermission("posts:write");
  if (!isMediaKey(key)) return { ok: false, error: "Invalid media key." };
  const db = await getDb();
  const rows = await db.select({ content: posts.content, coverImageKey: posts.coverImageKey }).from(posts);
  const referenced = rows.some(
    (row) => (row.content ?? "").includes(`/media/${key}`) || row.coverImageKey === `/media/${key}`,
  );
  if (referenced) return { ok: false, error: "This image is still used by a post." };

  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.MEDIA.delete(key);
    return { ok: true };
  } catch (err) {
    console.error("Failed to delete media key from R2", key, err);
    return { ok: false, error: "Failed to delete the image." };
  }
}
