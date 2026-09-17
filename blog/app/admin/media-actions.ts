"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function uploadImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };
  if (!ALLOWED_TYPES.has(file.type)) return { error: "Unsupported image type." };
  if (file.size > MAX_BYTES) return { error: "Image is larger than 8MB." };

  const { env } = await getCloudflareContext({ async: true });
  const ext = file.type.split("/")[1];
  const key = `${crypto.randomUUID()}.${ext}`;

  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    // Human-readable name for the media library (the key is the id).
    customMetadata: { name: file.name },
  });

  return { url: `/media/${key}` };
}

// Best-effort R2 cleanup for images no longer referenced by any post
// (called from posts-actions.ts on update/delete). Never throws: a failed
// delete just leaves an orphaned object in R2, which is harmless, rather
// than blocking the post save/delete itself.
export async function deleteMediaKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.MEDIA.delete(keys);
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
  const { env } = await getCloudflareContext({ async: true });
  const listed = await env.MEDIA.list({
    limit: options?.limit ?? 60,
    cursor: options?.cursor,
  });

  const items = listed.objects
    .filter((object) => /\.(webp|png|jpe?g|gif|avif)$/i.test(object.key))
    .map((object) => ({
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
