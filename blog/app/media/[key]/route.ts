import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const object = await env.MEDIA.get(key);

  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
}
