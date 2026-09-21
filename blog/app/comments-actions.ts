"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, gte } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db/client";
import { comments, commentVotes, posts } from "@/lib/db/schema";
import { getCommentsRequireApproval } from "@/lib/db/settings";
import { getOrCreateVoterKey } from "@/lib/voter";
import { getRequestIpHash } from "@/lib/anti-spam";
import { postPath } from "@/lib/post-url";
import { consumeRateLimit } from "@/lib/rate-limit";

const MAX_NAME_LENGTH = 60;
const MAX_COMMENT_LENGTH = 3000;
// Below this, the submission almost certainly wasn't a human reading the
// post and typing a reply — it's a script hitting the action directly.
const MIN_FILL_TIME_MS = 2000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const TURNSTILE_ACTION = "submit_comment";
const TURNSTILE_SECRET_KEY_LENGTH_MAX = 2048;

export type CommentActionState = { error: string } | { success: true; pending: boolean } | null;

type CommentNotification = {
  version: 1;
  type: "comment.created";
  eventId: string;
  commentId: number;
  postId: number;
  postSlug: string;
  authorName: string;
  contentPreview: string;
};

async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp: string | null,
  expectedHostname: string,
): Promise<boolean> {
  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  let result: { success: boolean; action?: string; hostname?: string };
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body,
    });
    if (!r.ok) return false;
    result = await r.json();
  } catch {
    return false;
  }

  if (!result.success || result.action !== TURNSTILE_ACTION || result.hostname !== expectedHostname) return false;
  return true;
}

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

  const turnstileToken = String(formData.get("cf-turnstile-response") ?? "").trim();
  if (!turnstileToken || turnstileToken.length > TURNSTILE_SECRET_KEY_LENGTH_MAX) {
    return { error: "Verification failed. Please try again." };
  }

  const { env } = await getCloudflareContext({ async: true });
  const hdrs = await headers();
  const remoteIp = hdrs.get("cf-connecting-ip") ?? hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const turnstileValid = await verifyTurnstileToken(
    turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    remoteIp,
    env.TURNSTILE_HOSTNAME,
  );
  if (!turnstileValid) {
    return { error: "Verification failed. Please try again." };
  }

  const postId = Number(formData.get("postId"));
  const parentIdValue = Number(formData.get("parentId"));
  const parentId = Number.isFinite(parentIdValue) && parentIdValue > 0 ? parentIdValue : null;
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

  if (parentId) {
    const [parent] = await db
      .select({ id: comments.id, postId: comments.postId, status: comments.status })
      .from(comments)
      .where(eq(comments.id, parentId));
    if (!parent || parent.postId !== postId || parent.status !== "approved") {
      return { error: "That comment cannot receive replies." };
    }
  }

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
  const [createdComment] = await db.insert(comments).values({
    postId,
    parentId,
    authorName,
    content,
    ipHash,
    status: requireApproval ? "pending" : "approved",
  }).returning({ id: comments.id });

  try {
    const notification: CommentNotification = {
      version: 1,
      type: "comment.created",
      eventId: `comment:${createdComment.id}`,
      commentId: createdComment.id,
      postId,
      postSlug: post.slug,
      authorName,
      contentPreview: content.slice(0, 200),
    };
    await env.COMMENT_NOTIFICATIONS.send(notification);
  } catch (error) {
    // The comment is already persisted. Keep the request successful and let
    // the structured log expose a producer failure for operations follow-up.
    console.error(JSON.stringify({
      event: "comment_notification_enqueue_failed",
      commentId: createdComment.id,
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  revalidatePath(`/${post.slug}`);
  revalidatePath(postPath({ slug: post.slug, category: post.category }));
  return { success: true, pending: requireApproval };
}

export async function voteComment(commentId: number, value: 1 | -1): Promise<{ ok: boolean; error?: string }> {
  const { env } = await getCloudflareContext({ async: true });
  const ipHash = await getRequestIpHash(env.SESSION_SECRET);
  const voterKey = await getOrCreateVoterKey();
  const rateKey = ipHash ?? `voter:${voterKey}`;
  if (!(await consumeRateLimit(env, `comment-vote:${rateKey}`, 60, 60))) {
    return { ok: false, error: "You're voting too quickly. Please try again later." };
  }

  const db = await getDb();
  const [comment] = await db.select({ id: comments.id, postId: comments.postId }).from(comments).where(eq(comments.id, commentId));
  if (!comment) return { ok: false, error: "Comment not found." };

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
  return { ok: true };
}
