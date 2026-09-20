import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";
import { getPostComments } from "@/lib/db/comment-queries";
import { getVoterKey } from "@/lib/voter";
import { CommentForm } from "@/components/CommentForm";
import { CommentVoteButtons } from "@/components/CommentVoteButtons";
import { SpiderWebCorner } from "@/components/SpiderWebCorner";

export async function CommentSection({ postId }: { postId: number }) {
  const voterKey = await getVoterKey();
  const commentList = await getPostComments(postId, voterKey);

  return (
    <section className="mt-16 max-w-2xl border-t-2 border-ink pt-10">
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-primary text-primary-foreground">
          <SpiderWebCorner className="absolute inset-0 h-full w-full text-primary-foreground/40" />
          <ChatCircleText className="relative h-5 w-5" weight="bold" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-bold tracking-tight">Reader comments</h2>
        <span className="rounded-full border-2 border-ink bg-card px-2.5 py-0.5 font-mono text-xs font-bold">
          {commentList.length}
        </span>
      </div>

      {commentList.length === 0 ? (
        <div className="comic-panel-sm mt-6 rounded-2xl border-2 border-dashed border-ink bg-card px-5 py-6 text-sm text-muted-foreground">
          No comments yet. Be the first to pin one below.
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {commentList.map((comment, index) => (
            <li key={comment.id} className="comic-panel-sm rounded-2xl border-2 border-ink bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-accent font-bold text-accent-foreground sm:flex">
                  {comment.authorName.slice(0, 1).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-bold">{comment.authorName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      #{String(index + 1).padStart(2, "0")}
                    </span>
                    <time
                      dateTime={comment.createdAt.toISOString()}
                      className="font-mono text-[11px] text-muted-foreground"
                    >
                      {comment.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                  <p className="mt-2 text-sm break-words whitespace-pre-wrap text-foreground">
                    {comment.content}
                  </p>
                </div>

                <CommentVoteButtons commentId={comment.id} score={comment.score} myVote={comment.myVote} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8">
        <CommentForm postId={postId} />
      </div>
    </section>
  );
}
