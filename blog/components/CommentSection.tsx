import { getPostComments } from "@/lib/db/comment-queries";
import { getVoterKey } from "@/lib/voter";
import { CommentForm } from "@/components/CommentForm";
import { CommentVoteButtons } from "@/components/CommentVoteButtons";

export async function CommentSection({ postId }: { postId: number }) {
  const voterKey = await getVoterKey();
  const commentList = await getPostComments(postId, voterKey);

  return (
    <section className="mt-16 max-w-2xl border-t border-border pt-10">
      <h2 className="text-xl font-bold">
        {commentList.length > 0 ? `${commentList.length} comment${commentList.length === 1 ? "" : "s"}` : "Comments"}
      </h2>

      <div className="mt-6 space-y-6">
        {commentList.map((comment) => (
          <div key={comment.id} className="flex gap-3 border-b border-dotted border-border pb-6">
            <CommentVoteButtons commentId={comment.id} score={comment.score} myVote={comment.myVote} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold">{comment.authorName}</span>
                <time dateTime={comment.createdAt.toISOString()} className="text-xs text-muted-foreground">
                  {comment.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <CommentForm postId={postId} />
      </div>
    </section>
  );
}
