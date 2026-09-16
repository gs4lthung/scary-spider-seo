"use client";

import { useOptimistic, useTransition } from "react";
import { CaretUp, CaretDown } from "@phosphor-icons/react";
import { voteComment } from "@/app/comments-actions";

export function CommentVoteButtons({
  commentId,
  score,
  myVote,
}: {
  commentId: number;
  score: number;
  myVote: -1 | 0 | 1;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    { score, myVote },
    (state, direction: 1 | -1) => {
      if (state.myVote === direction) return { score: state.score - direction, myVote: 0 as const };
      return { score: state.score - state.myVote + direction, myVote: direction };
    },
  );

  function vote(direction: 1 | -1) {
    startTransition(async () => {
      setOptimistic(direction);
      await voteComment(commentId, direction);
    });
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={() => vote(1)}
        disabled={isPending}
        aria-label="Upvote"
        aria-pressed={optimistic.myVote === 1}
        className={`rounded p-0.5 hover:bg-secondary ${optimistic.myVote === 1 ? "text-primary" : "text-muted-foreground"}`}
      >
        <CaretUp weight="bold" className="h-4 w-4" />
      </button>
      <span className="text-xs font-semibold text-foreground">{optimistic.score}</span>
      <button
        type="button"
        onClick={() => vote(-1)}
        disabled={isPending}
        aria-label="Downvote"
        aria-pressed={optimistic.myVote === -1}
        className={`rounded p-0.5 hover:bg-secondary ${optimistic.myVote === -1 ? "text-primary" : "text-muted-foreground"}`}
      >
        <CaretDown weight="bold" className="h-4 w-4" />
      </button>
    </div>
  );
}
