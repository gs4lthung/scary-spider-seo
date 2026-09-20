"use client";

import { useState } from "react";
import { ChatCircleText } from "@phosphor-icons/react";
import type { CommentData, PostComment } from "@/lib/db/comment-queries";
import { CommentForm } from "@/components/CommentForm";
import { CommentVoteButtons } from "@/components/CommentVoteButtons";

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatCommentDate(date: Date) {
  const secondsAgo = Math.round((date.getTime() - Date.now()) / 1000);
  for (const [unit, secondsPerUnit] of RELATIVE_UNITS) {
    if (Math.abs(secondsAgo) >= secondsPerUnit) {
      return relativeTimeFormatter.format(Math.round(secondsAgo / secondsPerUnit), unit);
    }
  }
  return "just now";
}

export function CommentItem({ comment, postId, turnstileSiteKey }: { comment: PostComment | CommentData; postId: number; turnstileSiteKey: string }) {
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const replies: CommentData[] = "replies" in comment ? comment.replies : [];

  return (
    <li className="border-b border-border py-5 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-accent text-sm font-bold text-accent-foreground">
          {comment.authorName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <span className="font-bold">{comment.authorName}</span>
          <p className="mt-1.5 text-sm leading-6 break-words whitespace-pre-wrap text-foreground">{comment.content}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <CommentVoteButtons commentId={comment.id} score={comment.score} myVote={comment.myVote} />
            <time dateTime={comment.createdAt.toISOString()} className="text-xs text-muted-foreground">
              {formatCommentDate(comment.createdAt)}
            </time>
            <button
              type="button"
              onClick={() => setReplying((value) => !value)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
            >
              <ChatCircleText className="h-4 w-4" weight="bold" aria-hidden="true" />
              Reply
            </button>
            {replies.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowReplies((value) => !value)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {showReplies ? "Hide replies" : `Show ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
              </button>
            ) : null}
          </div>
          {replying ? (
            <div className="mt-4 border-l-2 border-primary/40 pl-4">
              <CommentForm postId={postId} parentId={comment.id} onCancel={() => setReplying(false)} turnstileSiteKey={turnstileSiteKey} />
            </div>
          ) : null}
        </div>
      </div>
      {showReplies && replies.length > 0 ? (
        <ol className="mt-4 ml-4 border-l-2 border-border pl-4 sm:ml-12">
          {replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} postId={postId} turnstileSiteKey={turnstileSiteKey} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}
