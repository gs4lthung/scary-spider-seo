"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db/client";
import { comments, commentVotes, posts } from "@/lib/db/schema";
import { getCommentsRequireApproval } from "@/lib/db/settings";
import { getOrCreateVoterKey } from "@/lib/voter";
import { getRequestIpHash } from "@/lib/anti-spam";
import { postPath } from "@/lib/post-url";

const MAX_NAME_LENGTH = 60;
const MAX_COMMENT_LENGTH = 3000;
// Below this, the submission almost certainly wasn't a human reading the
// post and typing a reply — it's a script hitting the action directly.
const MIN_FILL_TIME_MS = 2000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

export type CommentActionState = { error: string } | { success: true; pending: boolean } | null;

export async function submitComment(_prevState: CommentActionState, formData: FormData): Promise<CommentActionState> {
  // Honeypot: a field real visitors never see or fill in. Bots that
  // autofill every field trip it; we pretend success without inserting.
  if (String(formData.get("website") ?? "").trim()) return { success: true, pending: false };

  // Time trap: the form stamps its own render time; anything submitted
  // near-instantly skipped actually reading the post.
  const formStartedAt = Number(formData.get("formStartedAt"));
  if (Number.isFinite(formStartedAt) && Date.now() - formStartedAt < MIN_FILL_TIME_MS) {
    return { error: "Please take a moment before submitting." };
  }

  const postId = Number(formData.get("postId"));
  const authorName = String(formData.get("authorName") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!Number.isFinite(postId)) return { error: "Invalid post." };
  if (!authorName) return { error: "Enter your name." };
  if (authorName.length > MAX_NAME_LENGTH) return { error: `Name must be under ${MAX_NAME_LENGTH} characters.` };
  if (!content) return { error: "Enter a comment." };
  if (content.length > MAX_COMMENT_LENGTH) return { error: `Comment must be under ${MAX_COMMENT_LENGTH} characters.` };

  const db = await getDb();
  const [post] = await db
    .select({ id: posts.id, slug: posts.slug, category: posts.category })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post) return { error: "Post not found." };

  const { env } = await getCloudflareContext({ async: true });
  const ipHash = await getRequestIpHash(env.SESSION_SECRET);
  if (ipHash) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recent = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.ipHash, ipHash), gte(comments.createdAt, since)));
    if (recent.length >= RATE_LIMIT_MAX) {
      return { error: "You're posting comments too quickly. Please wait a bit and try again." };
    }
  }

  const requireApproval = await getCommentsRequireApproval();
  await db.insert(comments).values({
    postId,
    authorName,
    content,
    ipHash,
    status: requireApproval ? "pending" : "approved",
  });

  revalidatePath(`/${post.slug}`);
  revalidatePath(postPath({ slug: post.slug, category: post.category }));
  return { success: true, pending: requireApproval };
}

export async function voteComment(commentId: number, value: 1 | -1): Promise<void> {
  const db = await getDb();
  const [comment] = await db.select({ id: comments.id, postId: comments.postId }).from(comments).where(eq(comments.id, commentId));
  if (!comment) return;

  const voterKey = await getOrCreateVoterKey();
  const [existing] = await db
    .select()
    .from(commentVotes)
    .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.voterKey, voterKey)));

  if (existing && existing.value === value) {
    // Clicking the same direction again retracts the vote.
    await db.delete(commentVotes).where(eq(commentVotes.id, existing.id));
  } else if (existing) {
    await db.update(commentVotes).set({ value }).where(eq(commentVotes.id, existing.id));
  } else {
    await db.insert(commentVotes).values({ commentId, voterKey, value });
  }

  const [post] = await db
    .select({ slug: posts.slug, category: posts.category })
    .from(posts)
    .where(eq(posts.id, comment.postId));
  if (post) {
    revalidatePath(`/${post.slug}`);
    revalidatePath(postPath({ slug: post.slug, category: post.category }));
  }
}
