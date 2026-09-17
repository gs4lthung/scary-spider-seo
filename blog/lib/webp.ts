// Client-side image re-encode: converts an uploaded JPEG/PNG to WebP in the
// browser (canvas) before it is sent to the `uploadImage` server action, so
// R2 only ever stores compact WebP files instead of full-size originals.
//
// Why the browser and not the Worker: WebP encoding needs a native codec.
// Cloudflare Workers can't run one without bundling a large WASM binary, so
// the admin page does the conversion with the browser's built-in
// `canvas.toBlob("image/webp")` and uploads the smaller result.
//
// GIFs and AVIFs are passed through untouched: GIF to preserve animation
// (canvas can only draw the first frame), AVIF because it is already a
// modern, compact format.

const CONVERTABLE_TYPES = new Set(["image/jpeg", "image/png"]);

export async function fileToWebP(file: File, quality = 0.82): Promise<File> {
  if (!CONVERTABLE_TYPES.has(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) throw new Error("WebP encoding failed");

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}