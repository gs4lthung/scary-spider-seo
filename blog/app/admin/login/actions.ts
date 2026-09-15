"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createSessionCookieValue, verifyPassword, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";

export async function login(_prevState: string | null, formData: FormData): Promise<string | null> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return "Enter a username and password.";

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return "Incorrect username or password.";
  }

  const { env } = await getCloudflareContext({ async: true });
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
  redirect("/admin");
}

export async function logout() {
  "use server";
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}
