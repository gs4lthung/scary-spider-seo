"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { approveComment, rejectComment, deleteComment } from "@/app/admin/comments-actions";

type Status = "pending" | "approved" | "rejected";

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-700",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>{status}</span>;
}

export function CommentModerationRow({
  comment,
}: {
  comment: {
    id: number;
    authorName: string;
    content: string;
    status: Status;
    createdAt: Date;
    postSlug: string | null;
    postTitle: string | null;
  };
}) {
  const [status, setStatus] = useState(comment.status);
  const [deleted, setDeleted] = useState(false);
  const [pending, startTransition] = useTransition();

  function onApprove() {
    setStatus("approved");
    startTransition(() => approveComment(comment.id));
  }

  function onReject() {
    setStatus("rejected");
    startTransition(() => rejectComment(comment.id));
  }

  function onDelete() {
    if (!confirm("Delete this comment? This can't be undone.")) return;
    setDeleted(true);
    startTransition(() => deleteComment(comment.id));
  }

  if (deleted) return null;

  return (
    <tr>
      <td className="max-w-sm px-4 py-3 align-top">
        <p className="font-medium">{comment.authorName}</p>
        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{comment.content}</p>
      </td>
      <td className="px-4 py-3 align-top">
        {comment.postSlug ? (
          <Link href={`/${comment.postSlug}`} target="_blank" className="text-primary hover:underline">
            {comment.postTitle}
          </Link>
        ) : (
          <span className="text-muted-foreground">Deleted post</span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        {comment.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </td>
      <td className="px-4 py-3 align-top">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-3 text-right align-top">
        <div className="flex justify-end gap-3">
          {status !== "approved" ? (
            <button type="button" onClick={onApprove} disabled={pending} className="text-emerald-700 hover:underline disabled:opacity-50">
              Approve
            </button>
          ) : null}
          {status !== "rejected" ? (
            <button type="button" onClick={onReject} disabled={pending} className="text-amber-700 hover:underline disabled:opacity-50">
              Reject
            </button>
          ) : null}
          <button type="button" onClick={onDelete} disabled={pending} className="text-red-600 hover:underline disabled:opacity-50">
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
