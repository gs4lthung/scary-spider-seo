import { uploadImage } from "@/app/admin/media-actions";

// Images added to the post body are inserted into the editor as local blob
// URLs and only uploaded to R2 when the post is saved. `pendingImages` maps
// those blob URLs (plus the WebP File to send) until `resolvePendingImageUploads`
// swaps every blob src for a real /media/<key> URL.
export type PendingImage = {
  id: string;
  blobUrl: string;
  file: File;
  alt: string;
};

export async function resolvePendingImageUploads(html: string, pending: PendingImage[]): Promise<string> {
  const fileByUrl = new Map(pending.map((p) => [p.blobUrl, p.file]));
  const blobUrls = [...html.matchAll(/src="(blob:[^"]+)"/g)].map((m) => m[1]);

  const uploads = [...new Set(blobUrls)].map(async (url) => {
    const file = fileByUrl.get(url);
    if (!file) return null;
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadImage(formData);
    if ("error" in result) throw new Error(result.error);
    return { from: url, to: result.url };
  });

  const mappings = (await Promise.all(uploads)).filter((m): m is { from: string; to: string } => m !== null);

  let out = html;
  for (const { from, to } of mappings) {
    out = out.split(`src="${from}"`).join(`src="${to}"`);
  }
  return out;
}