"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";

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
