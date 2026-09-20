"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, ne, and, count } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { requirePermission, requireUser } from "@/lib/authz";

async function requireAdmin() {
  return requirePermission("users:write");
}

export async function createUser(_prevState: string | null, formData: FormData): Promise<string | null> {
  await requireAdmin();

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "editor";
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const jobTitle = String(formData.get("jobTitle") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;

  if (!username || !password) return "Username and password are required.";
  if (password.length < 8) return "Password must be at least 8 characters.";

  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.username, username));
  if (existing) return "That username is already taken.";

  await db
    .insert(users)
    .values({ username, passwordHash: await hashPassword(password), role, displayName, jobTitle, bio });
  revalidatePath("/admin/users");
  redirect(`/admin/users?toast=${encodeURIComponent("User created")}`);
  return null;
}

export async function updateUserRole(id: number, role: "admin" | "editor") {
  const session = await requireAdmin();

  if (role === "editor" && id === session.userId) {
    const db = await getDb();
    const [{ value: adminCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, id)));
    if (adminCount === 0) throw new Error("Can't demote the only remaining admin.");
  }

  const db = await getDb();
  await db.update(users).set({ role }).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

export async function deleteUser(id: number) {
  const session = await requireAdmin();
  if (id === session.userId) throw new Error("You can't delete your own account while signed in.");

  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) return;

  if (target.role === "admin") {
    const [{ value: adminCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, id)));
    if (adminCount === 0) throw new Error("Can't delete the only remaining admin.");
  }

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

// Updates the caller's own public profile (name, avatar, job title, bio, and
// social links). Revalidates the public author page so changes go live
// immediately.
export async function updateProfile(_prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await requireUser();

  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const jobTitle = String(formData.get("jobTitle") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const avatarKey = String(formData.get("avatarKey") ?? "").trim() || null;
  const website = String(formData.get("website") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const github = String(formData.get("github") ?? "").trim() || null;
  const twitter = String(formData.get("twitter") ?? "").trim() || null;
  const linkedin = String(formData.get("linkedin") ?? "").trim() || null;
  const facebook = String(formData.get("facebook") ?? "").trim() || null;

  const db = await getDb();
  await db
    .update(users)
    .set({ displayName, jobTitle, bio, avatarKey, website, email, github, twitter, linkedin, facebook })
    .where(eq(users.id, session.userId));
  revalidatePath(`/author/${session.username}`);
  redirect(`/admin/profile?toast=${encodeURIComponent("Profile saved")}`);
  return null;
}

const MIN_PASSWORD_LENGTH = 8;

// Changes the caller's own password, verified against the current hash.
// Sessions are stateless HMAC-signed cookies, so an already-issued session is
// not revoked by this; existing cookies stay valid until their 7-day TTL.
export async function changePassword(_prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await requireUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) return "Enter your current password.";
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (newPassword !== confirmPassword) return "New passwords don't match.";

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user) throw new Error("Not authenticated.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return "Current password is incorrect.";
  }

  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, user.id));
  redirect(`/admin/profile?toast=${encodeURIComponent("Password changed")}`);
  return null;
}
