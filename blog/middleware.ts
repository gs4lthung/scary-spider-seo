import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SESSION_COOKIE, verifySessionCookieValue } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const { env } = getCloudflareContext();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionCookieValue(env.SESSION_SECRET, token);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if ((pathname.startsWith("/admin/users") || pathname.startsWith("/admin/settings")) && session.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
