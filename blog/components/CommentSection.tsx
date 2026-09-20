import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";
import { getPostComments } from "@/lib/db/comment-queries";
import { getVoterKey } from "@/lib/voter";
import { CommentForm } from "@/components/CommentForm";
import { CommentItem } from "@/components/CommentItem";
import { SpiderWebCorner } from "@/components/SpiderWebCorner";

export async function CommentSection({ postId }: { postId: number }) {
  const voterKey = await getVoterKey();
  const commentList = await getPostComments(postId, voterKey);
  const commentCount = countComments(commentList);

  return (
    <section className="mt-16 max-w-2xl border-t-2 border-ink pt-10">
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-primary text-primary-foreground">
          <SpiderWebCorner className="absolute inset-0 h-full w-full text-primary-foreground/40" />
          <ChatCircleText className="relative h-5 w-5" weight="bold" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-bold tracking-tight">Reader comments</h2>
        <span className="rounded-full border-2 border-ink bg-card px-2.5 py-0.5 font-mono text-xs font-bold">
           {commentCount}
        </span>
      </div>

      {commentList.length === 0 ? (
        <div className="comic-panel-sm mt-6 rounded-2xl border-2 border-dashed border-ink bg-card px-5 py-6 text-sm text-muted-foreground">
          No comments yet. Be the first to pin one below.
        </div>
      ) : (
        <ol className="mt-6 rounded-2xl border-2 border-ink bg-card px-4 sm:px-6">
          {commentList.map((comment) => (
            <CommentItem key={comment.id} comment={comment} postId={postId} />
          ))}
        </ol>
      )}

      <div className="mt-8">
        <CommentForm postId={postId} />
      </div>
    </section>
  );
}

function countComments(comments: Awaited<ReturnType<typeof getPostComments>>): number {
  return comments.length + comments.reduce((total, comment) => total + comment.replies.length, 0);
}
