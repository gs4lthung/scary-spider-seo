import { getPostComments } from "@/lib/db/comment-queries";
import { getVoterKey } from "@/lib/voter";
import { CommentForm } from "@/components/CommentForm";
import { CommentList } from "@/components/CommentList";

export async function CommentSection({ postId }: { postId: number }) {
  const voterKey = await getVoterKey();
  const commentList = await getPostComments(postId, voterKey);
  const commentCount = countComments(commentList);

  return (
    <section className="mt-16 max-w-2xl border-t-2 border-ink pt-10">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold tracking-tight">Comments</h2>
        <span className="rounded-full border-2 border-ink bg-card px-2.5 py-0.5 font-mono text-xs font-bold">
          {commentCount}
        </span>
      </div>

      <div className="mt-6">
        <CommentForm postId={postId} />
      </div>

      {commentList.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-ink bg-card px-5 py-6 text-sm text-muted-foreground">
          No comments yet. Be the first to share your thoughts.
        </div>
      ) : (
        <div className="mt-6">
          <CommentList comments={commentList} postId={postId} />
        </div>
      )}
    </section>
  );
}

function countComments(comments: Awaited<ReturnType<typeof getPostComments>>): number {
  return comments.length + comments.reduce((total, comment) => total + comment.replies.length, 0);
}
