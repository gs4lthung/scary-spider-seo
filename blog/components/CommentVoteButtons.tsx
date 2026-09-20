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

  const buttonClass = (active: boolean) =>
    `flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-colors disabled:opacity-50 ${
      active
        ? "border-ink bg-primary text-primary-foreground"
        : "border-border text-muted-foreground hover:border-ink hover:bg-secondary hover:text-foreground"
    }`;

  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => vote(1)}
        disabled={isPending}
        aria-label="Upvote"
        aria-pressed={optimistic.myVote === 1}
        className={buttonClass(optimistic.myVote === 1)}
      >
        <CaretUp weight="bold" className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="min-w-5 text-center font-mono font-bold text-foreground">{optimistic.score}</span>
      <button
        type="button"
        onClick={() => vote(-1)}
        disabled={isPending}
        aria-label="Downvote"
        aria-pressed={optimistic.myVote === -1}
        className={buttonClass(optimistic.myVote === -1)}
      >
        <CaretDown weight="bold" className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
