"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { extractMediaKeys, diffRemovedMediaKeys } from "@/lib/media";
import { postPath } from "@/lib/post-url";
import { serializeTakeaways, serializeFaqs } from "@/lib/post-sections";
import { sanitizePostHtml, stripTags } from "@/lib/sanitize";
import { requireUser } from "@/lib/authz";
import { deleteMediaKeys } from "@/app/admin/media-actions";

function fromForm(formData: FormData) {
  const status = formData.get("status") === "published" ? "published" : "draft";
  return {
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    excerpt: (String(formData.get("excerpt") ?? "").trim() || null) as string | null,
    content: sanitizePostHtml(String(formData.get("content") ?? "")),
    keyTakeaways: serializeTakeaways(stripTags(String(formData.get("keyTakeaways") ?? ""))),
    faqs: serializeFaqs(
      (() => {
        try {
          const raw = String(formData.get("faqs") ?? "");
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed)
            ? parsed
                .filter(
                  (item) =>
                    item && typeof item.question === "string" && typeof item.answer === "string",
                )
                .map((item) => ({ question: stripTags(item.question), answer: stripTags(item.answer) }))
            : [];
        } catch {
          return [];
        }
      })(),
    ),
    coverImageKey: (String(formData.get("coverImageKey") ?? "").trim() || null) as string | null,
    coverImageAlt: (String(formData.get("coverImageAlt") ?? "").trim() || null) as string | null,
    authorId: (Number(formData.get("authorId")) || null) as number | null,
    category: (String(formData.get("category") ?? "").trim() || null) as string | null,
    metaTitle: (String(formData.get("metaTitle") ?? "").trim() || null) as string | null,
    metaDescription: (String(formData.get("metaDescription") ?? "").trim() || null) as string | null,
    status: status as "draft" | "published",
  };
}

function revalidatePublicPages(post: { slug: string; category: string | null }) {
  revalidatePath("/");
  revalidatePath(`/${post.slug}`);
  revalidatePath(postPath(post));
  revalidatePath("/sitemap.xml");
}

export async function createPost(_prevState: string | null, formData: FormData): Promise<string | null> {
  await requireUser();
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

  revalidatePublicPages(data);
  redirect(`/admin?toast=${encodeURIComponent("Post created")}`);
}

export async function updatePost(id: number, _prevState: string | null, formData: FormData): Promise<string | null> {
  await requireUser();
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

  revalidatePublicPages(existing);
  if (existing.slug !== data.slug) revalidatePublicPages(data);
  redirect(`/admin?toast=${encodeURIComponent("Post updated")}`);
}

export async function deletePost(id: number) {
  await requireUser();
  const db = await getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, id));
  if (!existing) return;

  await db.delete(posts).where(eq(posts.id, id));
  await deleteMediaKeys(extractMediaKeys(existing.content, existing.coverImageKey));
  revalidatePublicPages(existing);
  redirect(`/admin?toast=${encodeURIComponent("Post deleted")}`);
}
