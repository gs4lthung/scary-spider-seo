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
