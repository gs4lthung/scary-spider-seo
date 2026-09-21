"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { requirePermission, requireUser } from "@/lib/authz";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const MAX_BYTES = 8 * 1024 * 1024;
type ListedMediaObject = {
  key: string;
  customMetadata?: Record<string, string>;
  size: number;
  uploaded?: Date;
  httpMetadata?: { contentType?: string };
};

function hasImageSignature(bytes: Uint8Array, type: string): boolean {
  if (type === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).toString() === "137,80,78,71,13,10,26,10";
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/gif") return new TextDecoder().decode(bytes.slice(0, 6)) === "GIF87a" || new TextDecoder().decode(bytes.slice(0, 6)) === "GIF89a";
  if (type === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (type === "image/avif") return new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
  return false;
}

function isMediaKey(key: string): boolean {
  return /^[0-9a-f-]{36}\.(png|jpe?g|webp|gif|avif)$/i.test(key);
}

export async function uploadImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };
  if (!ALLOWED_TYPES.has(file.type)) return { error: "Unsupported image type." };
  if (file.size > MAX_BYTES) return { error: "Image is larger than 8MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasImageSignature(bytes, file.type)) return { error: "The uploaded file does not match its image type." };

  const { env } = await getCloudflareContext({ async: true });
  const ext = file.type.split("/")[1];
  const key = `${crypto.randomUUID()}.${ext}`;

  await env.MEDIA.put(key, bytes, {
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

  const items = listed.objects
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
