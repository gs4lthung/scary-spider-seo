import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SESSION_COOKIE, verifySessionCookieValue } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Logged-out pages: sign in, and the password reset flow
  // (app/admin/password-reset-actions.ts).
  if (pathname === "/admin/login" || pathname === "/admin/forgot-password" || pathname === "/admin/reset-password") {
    return NextResponse.next();
  }

  const { env } = getCloudflareContext();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionCookieValue(env.SESSION_SECRET, token);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Role authorization is enforced with a fresh DB read by the admin pages
  // and server actions (lib/authz.ts) so a role change or account deletion
  // takes effect immediately instead of waiting on the cookie's stale role.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
