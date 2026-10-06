import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";

// Password reset by email link.
//
// Flow: an admin clicks "Send reset link" on /admin/users, or a user submits
// their login email on /admin/forgot-password. A random token is emailed (via
// Resend) as /admin/reset-password?token=..., and only its SHA-256 hash is
// stored. The link works once, for RESET_TOKEN_TTL_MS. A successful reset sets
// users.passwordChangedAt, which signs out every existing session.
//
// Config: RESEND_API_KEY (secret, `wrangler secret put RESEND_API_KEY`) and
// optional RESEND_FROM (e.g. "Scary Spider SEO <no-reply@scaryspiderseo.com>";
// its domain must be verified in Resend).

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_FROM = "Scary Spider SEO <no-reply@scaryspiderseo.com>";

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The link must point at this deployment (production, staging or local dev),
// but a Host header alone can be spoofed, so only hosts this app is configured
// for are trusted. Anything else falls back to the production SITE_URL.
async function resetBaseUrl(): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  const host = (await headers()).get("host") ?? "";
  const trusted = new Set([new URL(SITE_URL).host, env.TURNSTILE_HOSTNAME].filter(Boolean));
  if (!trusted.has(host)) return SITE_URL;
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") ? `http://${host}` : `https://${host}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.RESEND_API_KEY) throw new Error("Email is not configured: RESEND_API_KEY is missing.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM || DEFAULT_FROM, to: [to], subject, text, html }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend rejected the email (HTTP ${response.status}). ${detail.slice(0, 300)}`);
  }
}

// Best-effort notice to the PREVIOUS login email when it is changed or
// removed, so a hijacked session can't quietly redirect reset links to
// another inbox. Never throws: a failed notice must not block the update.
export async function notifyLoginEmailChanged(oldEmail: string, username: string): Promise<void> {
  const text = [
    `Hi ${username},`,
    "",
    "The login email for your Scary Spider SEO Blog admin account was just changed, so password reset links will no longer be sent to this address.",
    "",
    "If you made this change, you can ignore this email. If you did not, contact a site admin right away.",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(username)},</p>
<p>The login email for your Scary Spider SEO Blog admin account was just changed, so password reset links will no longer be sent to this address.</p>
<p>If you made this change, you can ignore this email. If you did not, contact a site admin right away.</p>`;
  try {
    await sendEmail(oldEmail, "Your Scary Spider SEO Blog login email was changed", text, html);
  } catch (err) {
    console.error("Failed to send login email change notice", err);
  }
}

async function sendResetEmail(to: string, username: string, link: string): Promise<void> {
  const minutes = Math.round(RESET_TOKEN_TTL_MS / 60000);
  const text = [
    `Hi ${username},`,
    "",
    "Someone asked to reset the password for your Scary Spider SEO Blog admin account.",
    `Open this link to choose a new password. It works once and expires in ${minutes} minutes:`,
    "",
    link,
    "",
    "If you did not ask for this, you can ignore this email. Your password stays the same.",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(username)},</p>
<p>Someone asked to reset the password for your Scary Spider SEO Blog admin account.</p>
<p><a href="${escapeHtml(link)}">Choose a new password</a></p>
<p>The link works once and expires in ${minutes} minutes. If the button does not work, copy this address into your browser:<br>${escapeHtml(link)}</p>
<p>If you did not ask for this, you can ignore this email. Your password stays the same.</p>`;

  await sendEmail(to, "Reset your Scary Spider SEO Blog password", text, html);
}

// Creates a fresh link (invalidating any earlier unused ones for this user)
// and emails it. Throws if sending fails, after removing the unsent token.
export async function issuePasswordReset(user: { id: number; username: string; loginEmail: string }): Promise<void> {
  const db = await getDb();
  const token = randomToken();
  const tokenHash = await sha256Hex(token);

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  const link = `${await resetBaseUrl()}/admin/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendResetEmail(user.loginEmail, user.username, link);
  } catch (err) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
    throw err;
  }
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  if (!token) return false;
  const db = await getDb();
  const rows = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, await sha256Hex(token)), gt(passwordResetTokens.expiresAt, new Date())));
  return rows.length > 0;
}

// Claims the token by deleting it (so it can't be used twice, even by two
// requests at once), then sets the new password. Returns false if the token
// is unknown, already used or expired.
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  if (!token) return false;
  const db = await getDb();
  const claimed = await db
    .delete(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, await sha256Hex(token)), gt(passwordResetTokens.expiresAt, new Date())))
    .returning({ userId: passwordResetTokens.userId });
  if (claimed.length === 0) return false;

  const userId = claimed[0].userId;
  // passwordChangedAt signs out every session issued before now (see
  // lib/session.ts::getCurrentUser).
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() })
    .where(eq(users.id, userId));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  return true;
}
