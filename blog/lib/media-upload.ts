import { getCloudflareContext } from "@opennextjs/cloudflare";

// Server-side image validation and R2 storage, used by the /admin/upload
// route handler (app/admin/upload/route.ts).
//
// Uploads deliberately do NOT go through a server action. Cloudflare's free
// managed WAF ruleset ("React - Leaking Server Functions", CVE-2025-55183)
// inspects server action request bodies, and raw image bytes in a multipart
// server action body intermittently match it, so uploads got blocked with a
// 403 at the edge. A plain POST of the raw bytes to a route handler is not a
// server action request, so that rule never sees it.

export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function hasImageSignature(bytes: Uint8Array, type: string): boolean {
  if (type === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).toString() === "137,80,78,71,13,10,26,10";
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/gif") return new TextDecoder().decode(bytes.slice(0, 6)) === "GIF87a" || new TextDecoder().decode(bytes.slice(0, 6)) === "GIF89a";
  if (type === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (type === "image/avif") return new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
  return false;
}

export async function storeImage(
  bytes: Uint8Array,
  type: string,
  name: string,
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_IMAGE_TYPES.has(type)) return { error: "Unsupported image type." };
  if (bytes.length === 0) return { error: "No file provided." };
  if (bytes.length > MAX_IMAGE_BYTES) return { error: "Image is larger than 8MB." };
  if (!hasImageSignature(bytes, type)) return { error: "The uploaded file does not match its image type." };

  const { env } = await getCloudflareContext({ async: true });
  const ext = type.split("/")[1];
  const key = `${crypto.randomUUID()}.${ext}`;

  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: type },
    // Human-readable name for the media library (the key is the id).
    customMetadata: { name: name.slice(0, 200) },
  });

  return { url: `/media/${key}` };
}
