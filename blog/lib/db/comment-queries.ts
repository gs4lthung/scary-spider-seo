import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import { comments, commentVotes, posts } from "./schema";

export type CommentData = typeof comments.$inferSelect & {
  score: number;
  myVote: -1 | 0 | 1;
};

export type PostComment = CommentData & { replies: CommentData[] };

export async function getPostComments(postId: number, voterKey: string | null): Promise<PostComment[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.postId, postId), eq(comments.status, "approved")))
    .orderBy(asc(comments.createdAt));

  if (rows.length === 0) return [];

  const votes = await db
    .select()
    .from(commentVotes)
    .where(inArray(commentVotes.commentId, rows.map((r) => r.id)));

  const scoreByComment = new Map<number, number>();
  const myVoteByComment = new Map<number, -1 | 0 | 1>();
  for (const v of votes) {
    scoreByComment.set(v.commentId, (scoreByComment.get(v.commentId) ?? 0) + v.value);
    if (voterKey && v.voterKey === voterKey) myVoteByComment.set(v.commentId, v.value as -1 | 1);
  }

  const enriched: PostComment[] = rows.map((r) => ({
    ...r,
    score: scoreByComment.get(r.id) ?? 0,
    myVote: myVoteByComment.get(r.id) ?? 0,
    replies: [] as CommentData[],
  }));

  const byId = new Map(enriched.map((comment) => [comment.id, comment]));
  const roots: PostComment[] = [];
  for (const comment of enriched) {
    const parent = comment.parentId ? byId.get(comment.parentId) : undefined;
    if (parent) parent.replies.push(comment);
    else roots.push(comment);
  }
  return roots;
}

export async function getCommentsForModeration() {
  const db = await getDb();
  return db
    .select({
      id: comments.id,
      postId: comments.postId,
      postSlug: posts.slug,
      postCategory: posts.category,
      postTitle: posts.title,
      authorName: comments.authorName,
      content: comments.content,
      status: comments.status,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(posts, eq(posts.id, comments.postId))
    .orderBy(desc(comments.createdAt));
}

export async function getPendingCommentCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ status: comments.status }).from(comments);
  return rows.filter((r) => r.status === "pending").length;
}
