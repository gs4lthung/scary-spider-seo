import { getCommentsForModeration } from "@/lib/db/comment-queries";
import { CommentModerationRow } from "./CommentModerationRow";

export default async function CommentsPage() {
  const commentList = await getCommentsForModeration();
  const pendingCount = commentList.filter((c) => c.status === "pending").length;

  return (
    <div>
      <h1 className="text-2xl font-bold">Comments</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {pendingCount > 0 ? `${pendingCount} awaiting approval.` : "All caught up."}
      </p>

      {commentList.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="font-semibold">No comments yet.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs text-muted-foreground uppercase">
                <th className="px-4 py-3 font-semibold">Comment</th>
                <th className="px-4 py-3 font-semibold">Post</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {commentList.map((c) => (
                <CommentModerationRow key={c.id} comment={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
