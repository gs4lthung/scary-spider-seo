"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createSessionCookieValue, verifyPassword, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";
import { getRequestIpHash } from "@/lib/anti-spam";
import { isLoginLocked, recordFailedLogin, clearFailedLogins } from "@/lib/login-rate-limit";

export async function login(_prevState: string | null, formData: FormData): Promise<string | null> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return "Enter a username and password.";

  const { env } = await getCloudflareContext({ async: true });
  const ipHash = await getRequestIpHash(env.SESSION_SECRET);
  if (ipHash && (await isLoginLocked(ipHash))) {
    return "Too many failed attempts. Please wait 15 minutes and try again.";
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    if (ipHash) await recordFailedLogin(ipHash);
    return "Incorrect username or password.";
  }

  if (ipHash) await clearFailedLogins(ipHash);

  const value = await createSessionCookieValue(env.SESSION_SECRET, {
    userId: user.id,
    username: user.username,
    role: user.role,
  });
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect(`/admin?toast=${encodeURIComponent("Signed in")}`);
}

export async function logout() {
  "use server";
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}
