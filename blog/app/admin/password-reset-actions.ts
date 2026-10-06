"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getRequestIpHash } from "@/lib/anti-spam";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  issuePasswordReset,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  resetPasswordWithToken,
  sha256Hex,
} from "@/lib/password-reset";

// Public (logged-out) actions behind /admin/forgot-password and
// /admin/reset-password. middleware.ts lets both paths through without a
// session. See lib/password-reset.ts for the token design.

const GENERIC_SENT_MESSAGE =
  "If that email belongs to an account, a reset link is on its way. It expires in 1 hour. Check your spam folder too.";

export async function requestPasswordReset(
  _prevState: { message: string; error: boolean } | null,
  formData: FormData,
): Promise<{ message: string; error: boolean }> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { message: "Enter a valid email address.", error: true };

  const { env } = await getCloudflareContext({ async: true });
  const ipHash = await getRequestIpHash(env.SESSION_SECRET);
  // 5 requests per IP and 3 per address every 15 minutes, so the form can't
  // be used to flood someone's inbox.
  const ipAllowed = ipHash ? await consumeRateLimit(env, `pwreset-ip:${ipHash}`, 5, 15 * 60) : true;
  const emailAllowed = await consumeRateLimit(env, `pwreset-email:${await sha256Hex(email)}`, 3, 15 * 60);
  if (!ipAllowed) return { message: "Too many requests. Please wait 15 minutes and try again.", error: true };

  // The same answer whether or not the address exists, so the form can't be
  // used to find out which emails have accounts.
  if (!emailAllowed) return { message: GENERIC_SENT_MESSAGE, error: false };

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.loginEmail, email));
  if (user?.loginEmail) {
    try {
      await issuePasswordReset({ id: user.id, username: user.username, loginEmail: user.loginEmail });
    } catch (err) {
      console.error("Failed to send password reset email", err);
    }
  }
  return { message: GENERIC_SENT_MESSAGE, error: false };
}

export async function resetPassword(_prevState: string | null, formData: FormData): Promise<string | null> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (newPassword !== confirmPassword) return "New passwords don't match.";

  const ok = await resetPasswordWithToken(token, newPassword);
  if (!ok) return "This reset link is invalid, already used or expired. Request a new one.";

  redirect(`/admin/login?toast=${encodeURIComponent("Password reset. Sign in with your new password.")}`);
}
