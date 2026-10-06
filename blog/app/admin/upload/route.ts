import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { MAX_IMAGE_BYTES, storeImage } from "@/lib/media-upload";

// Image upload endpoint. The client (lib/upload-image.ts) POSTs the raw image
// bytes with the image MIME type as Content-Type and the original file name
// in X-File-Name. See lib/media-upload.ts for why this is a route handler and
// not a server action.

function json(body: { url: string } | { error: string }, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  // Server actions get a built-in Origin check; a route handler does not, so
  // reject cross-site requests here (the session cookie is also SameSite=Lax).
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    // "null" (sandboxed/opaque origins) or garbage: treat as cross-site.
  }
  if (!originHost || !host || originHost !== host) return json({ error: "Invalid request origin." }, 403);

  // middleware.ts already redirects requests without a session, but auth is
  // re-checked against the DB here like every admin action (lib/authz.ts).
  const user = await getCurrentUser();
  if (!user) return json({ error: "Not authenticated." }, 401);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_IMAGE_BYTES) return json({ error: "Image is larger than 8MB." }, 413);

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  let name = "image";
  try {
    name = decodeURIComponent(request.headers.get("x-file-name") ?? "image") || "image";
  } catch {
    // Keep the fallback name if the header is not valid percent-encoding.
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  const result = await storeImage(bytes, type, name);
  return json(result, "error" in result ? 400 : 200);
}
