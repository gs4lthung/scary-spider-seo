"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { comments, posts } from "@/lib/db/schema";
import { postPath } from "@/lib/post-url";
import { getSession } from "@/lib/session";

async function requireModerator() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated.");
  return session;
}

async function revalidateCommentedPost(commentId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ slug: posts.slug, category: posts.category })
    .from(comments)
    .leftJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, commentId));
  if (row?.slug) {
    revalidatePath(`/${row.slug}`);
    revalidatePath(postPath({ slug: row.slug, category: row.category }));
  }
}

export async function approveComment(commentId: number) {
  await requireModerator();
  const db = await getDb();
  await db.update(comments).set({ status: "approved" }).where(eq(comments.id, commentId));
  await revalidateCommentedPost(commentId);
  revalidatePath("/admin/comments");
}

export async function rejectComment(commentId: number) {
  await requireModerator();
  const db = await getDb();
  await db.update(comments).set({ status: "rejected" }).where(eq(comments.id, commentId));
  await revalidateCommentedPost(commentId);
  revalidatePath("/admin/comments");
}

export async function deleteComment(commentId: number) {
  await requireModerator();
  await revalidateCommentedPost(commentId);
  const db = await getDb();
  await db.delete(comments).where(eq(comments.id, commentId));
  revalidatePath("/admin/comments");
}
