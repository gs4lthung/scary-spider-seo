import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, verifySessionCookieValue, type SessionPayload } from "./auth";
import { getDb } from "./db/client";
import { users } from "./db/schema";

export async function getSession(): Promise<SessionPayload | null> {
  const { env } = await getCloudflareContext({ async: true });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionCookieValue(env.SESSION_SECRET, token);
}

// Re-reads the signed-in user from the DB so a role change, deletion, or any
// other account state change takes effect immediately instead of trusting the
// role/user baked into the session cookie for up to its 7-day TTL. Returns
// null when the cookie is invalid, the user no longer exists, or the session
// was issued before the user's password was last reset (passwordChangedAt),
// which is how a password reset signs out every existing session.
export async function getCurrentUser(): Promise<(SessionPayload & { avatarKey: string | null }) | null> {
  const session = await getSession();
  if (!session) return null;
  const db = await getDb();
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      avatarKey: users.avatarKey,
      passwordChangedAt: users.passwordChangedAt,
    })
    .from(users)
    .where(eq(users.id, session.userId));
  if (!user) return null;
  // Cookies carry no issued-at, but exp is always issue time + TTL.
  const issuedAt = session.exp - SESSION_TTL_SECONDS * 1000;
  if (user.passwordChangedAt && issuedAt < user.passwordChangedAt.getTime()) return null;
  return { userId: user.id, username: user.username, role: user.role, avatarKey: user.avatarKey, exp: session.exp };
}
