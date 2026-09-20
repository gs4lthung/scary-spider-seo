"use client";

import { useState } from "react";
import type { PostComment } from "@/lib/db/comment-queries";
import { CommentItem } from "@/components/CommentItem";

const PAGE_SIZE = 5;

export function CommentList({ comments, postId, turnstileSiteKey }: { comments: PostComment[]; postId: number; turnstileSiteKey: string }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleComments = comments.slice(0, visibleCount);
  const remaining = comments.length - visibleComments.length;

  return (
    <>
      <ol className="rounded-2xl border-2 border-ink bg-card px-4 sm:px-6">
        {visibleComments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} postId={postId} turnstileSiteKey={turnstileSiteKey} />
        ))}
      </ol>
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="mt-3 w-full rounded-lg border-2 border-ink bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Load more ({remaining})
        </button>
      ) : null}
    </>
  );
}
