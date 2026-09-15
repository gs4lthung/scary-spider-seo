import { NextResponse, type NextRequest } from "next/server";
import { analyzePage } from "@/lib/seo-audit/analyze";
import { fetchPageSafely, UnsafeUrlError } from "@/lib/seo-audit/fetch";

export const runtime = "nodejs";

// Best-effort per-instance rate limit. Serverless instances aren't shared,
// so this doesn't cap total traffic, but it stops a single client from
// hammering one warm instance with fetches.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_LIMIT;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "Enter a URL to audit." }, { status: 400 });
  }

  // Only add a scheme when none is present — a string like "ftp://host"
  // already has one and must reach assertPublicHttpUrl unchanged so it's
  // rejected with a clear "only http/https" error instead of being mangled
  // into "https://ftp://host" (which parses as host "ftp").
  const trimmed = url.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const normalized = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const page = await fetchPageSafely(normalized);
    if (page.status < 200 || page.status >= 400) {
      return NextResponse.json({ error: `The page responded with HTTP ${page.status}.` }, { status: 502 });
    }
    return NextResponse.json(analyzePage(page));
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Couldn't fetch that URL.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
