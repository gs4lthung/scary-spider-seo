"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { categories, posts } from "@/lib/db/schema";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createCategory(_prevState: string | null, formData: FormData): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Category name is required.";

  const db = await getDb();
  const slug = slugify(name);
  const [existing] = await db.select().from(categories).where(eq(categories.name, name));
  if (existing) return "That category already exists.";

  await db.insert(categories).values({ name, slug });
  revalidatePath("/admin/categories");
  return null;
}

export async function renameCategory(id: number, newName: string) {
  const name = newName.trim();
  if (!name) throw new Error("Category name can't be empty.");

  const db = await getDb();
  const [category] = await db.select().from(categories).where(eq(categories.id, id));
  if (!category) return;

  await db.update(categories).set({ name, slug: slugify(name) }).where(eq(categories.id, id));
  // Keep existing posts' freeform category text in sync with the rename.
  await db.update(posts).set({ category: name }).where(eq(posts.category, category.name));

  revalidatePath("/admin/categories");
  revalidatePath("/");
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/admin/categories");
}
