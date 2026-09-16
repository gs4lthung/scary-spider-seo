"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { extractMediaKeys, diffRemovedMediaKeys } from "@/lib/media";
import { deleteMediaKeys } from "@/app/admin/media-actions";

function fromForm(formData: FormData) {
  const status = formData.get("status") === "published" ? "published" : "draft";
  return {
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    excerpt: (String(formData.get("excerpt") ?? "").trim() || null) as string | null,
    content: String(formData.get("content") ?? ""),
    coverImageKey: (String(formData.get("coverImageKey") ?? "").trim() || null) as string | null,
    coverImageAlt: (String(formData.get("coverImageAlt") ?? "").trim() || null) as string | null,
    category: (String(formData.get("category") ?? "").trim() || null) as string | null,
    metaTitle: (String(formData.get("metaTitle") ?? "").trim() || null) as string | null,
    metaDescription: (String(formData.get("metaDescription") ?? "").trim() || null) as string | null,
    status: status as "draft" | "published",
  };
}

function revalidatePublicPages(slug: string) {
  revalidatePath("/");
  revalidatePath(`/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function createPost(_prevState: string | null, formData: FormData): Promise<string | null> {
  const data = fromForm(formData);
  if (!data.slug || !data.title || !data.content) {
    return "Slug, title, and content are required.";
  }
  if (data.coverImageKey && !data.coverImageAlt) {
    return "Cover image alt text is required whenever a cover image is set.";
  }

  const db = await getDb();
  await db.insert(posts).values({
    ...data,
    publishedAt: data.status === "published" ? new Date() : null,
  });

  revalidatePublicPages(data.slug);
  redirect("/admin");
}

export async function updatePost(id: number, _prevState: string | null, formData: FormData): Promise<string | null> {
  const data = fromForm(formData);
  if (!data.slug || !data.title || !data.content) {
    return "Slug, title, and content are required.";
  }
  if (data.coverImageKey && !data.coverImageAlt) {
    return "Cover image alt text is required whenever a cover image is set.";
  }

  const db = await getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, id));
  if (!existing) return "Post not found.";

  await db
    .update(posts)
    .set({
      ...data,
      publishedAt: data.status === "published" ? (existing.publishedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));

  await deleteMediaKeys(diffRemovedMediaKeys(existing, data));

  revalidatePublicPages(existing.slug);
  if (existing.slug !== data.slug) revalidatePublicPages(data.slug);
  redirect("/admin");
}

export async function deletePost(id: number) {
  const db = await getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, id));
  if (!existing) return;

  await db.delete(posts).where(eq(posts.id, id));
  await deleteMediaKeys(extractMediaKeys(existing.content, existing.coverImageKey));
  revalidatePublicPages(existing.slug);
  redirect("/admin");
}
