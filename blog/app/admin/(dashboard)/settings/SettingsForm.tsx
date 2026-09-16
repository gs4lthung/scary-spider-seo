"use client";

import { useActionState } from "react";
import { updateSettings } from "@/app/admin/settings-actions";

export function SettingsForm({
  postsPerPage,
  commentsRequireApproval,
}: {
  postsPerPage: number;
  commentsRequireApproval: boolean;
}) {
  const [error, formAction, pending] = useActionState(updateSettings, null);

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-border bg-card p-4">
      <div className="flex items-end gap-3">
        <div>
          <label htmlFor="postsPerPage" className="block text-xs font-medium text-muted-foreground">
            Posts per page
          </label>
          <input
            id="postsPerPage"
            name="postsPerPage"
            type="number"
            min={1}
            max={50}
            required
            defaultValue={postsPerPage}
            className="mt-1 w-24 rounded border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="commentsRequireApproval"
            defaultChecked={commentsRequireApproval}
            className="h-4 w-4 rounded border-border"
          />
          Hold new comments for approval before they show publicly
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Comments are anonymous for now, so this is on by default. Approve or reject them in{" "}
          <span className="font-medium text-foreground">Comments</span>.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </form>
  );
}
