import { NextResponse, type NextRequest } from "next/server";

// Set MAINTENANCE_MODE=true (Vercel env var, or .env.local for local
// testing) to take the whole site down for planned maintenance — every
// request gets rewritten to /maintenance with a real 503 status instead of
// Next.js's normal 200, until the flag is removed.
export function middleware(request: NextRequest) {
  const maintenanceMode = process.env.MAINTENANCE_MODE === "true";
  const { pathname } = request.nextUrl;

  if (maintenanceMode && !pathname.startsWith("/maintenance")) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    const response = NextResponse.rewrite(url, { status: 503 });
    response.headers.set("Retry-After", "1800");
    return response;
  }

  // demo.scaryspiderseo.com is an alias for this same app: point the
  // Vercel domain at this project, then requests to "/" and "/api/..." on
  // that host transparently serve the /demo page and its API route.
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("demo.") && !pathname.startsWith("/demo")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/demo" : `/demo${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static assets, images, and Next's internals — only gate actual pages.
    "/((?!_next/static|_next/image|favicon|apple-touch-icon|og-image|mascot|logo-wordmark|robots.txt|sitemap.xml).*)",
  ],
};
