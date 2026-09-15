"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, and, count } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth";
import { getSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Forbidden");
  return session;
}

export async function createUser(_prevState: string | null, formData: FormData): Promise<string | null> {
  await requireAdmin();

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "editor";

  if (!username || !password) return "Username and password are required.";
  if (password.length < 8) return "Password must be at least 8 characters.";

  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.username, username));
  if (existing) return "That username is already taken.";

  await db.insert(users).values({ username, passwordHash: await hashPassword(password), role });
  revalidatePath("/admin/users");
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
