import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "./db/client";
import { loginAttempts } from "./db/schema";

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

// Admin login is protected from brute force by counting failed attempts per
// HMAC'd IP hash (never the raw IP, see lib/anti-spam.ts). After MAX_FAILED_ATTEMPTS
// failures inside the window the IP is locked out for the rest of the window,
// even with the correct password, so an attacker can't keep guessing. A
// successful login clears the count.
export async function isLoginLocked(ipHash: string): Promise<boolean> {
  const db = await getDb();
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, since));
  const rows = await db
    .select({ id: loginAttempts.id })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ipHash, ipHash), gte(loginAttempts.attemptedAt, since)));
  return rows.length >= MAX_FAILED_ATTEMPTS;
}

export async function recordFailedLogin(ipHash: string): Promise<void> {
  const db = await getDb();
  await db.insert(loginAttempts).values({ ipHash });
}

export async function clearFailedLogins(ipHash: string): Promise<void> {
  const db = await getDb();
  await db.delete(loginAttempts).where(eq(loginAttempts.ipHash, ipHash));
}