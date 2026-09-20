import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRequestIpHash } from "@/lib/anti-spam";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { consumeRateLimit } from "@/lib/rate-limit";

const VIEW_COOKIE_PREFIX = "post-viewed-";
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24;

function getPostId(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

function getPostIdFromBody(body: unknown): number | null {
  if (typeof body !== "object" || body === null || !("postId" in body)) return null;
  return getPostId(body.postId);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const postId = getPostIdFromBody(body);
  if (postId === null) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

  const cookieName = `${VIEW_COOKIE_PREFIX}${postId}`;
  if (request.headers.get("cookie")?.split(";").some((cookie) => cookie.trim().startsWith(`${cookieName}=`))) {
    return NextResponse.json({ counted: false });
  }

  const { env } = await getCloudflareContext({ async: true });
  const ipHash = await getRequestIpHash(env.SESSION_SECRET);
  if (ipHash && !(await consumeRateLimit(env, `track-view:${ipHash}`, 30, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const db = await getDb();
  const updated = await db
    .update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1` })
    .where(and(eq(posts.id, postId), eq(posts.status, "published")))
    .returning({ viewCount: posts.viewCount });

  if (updated.length === 0) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const response = NextResponse.json({ counted: true, viewCount: updated[0].viewCount });
  response.cookies.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: VIEW_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
