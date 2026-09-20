"use client";

import { useActionState } from "react";
import { createUser } from "@/app/admin/users-actions";

export function CreateUserForm() {
  const [error, formAction, pending] = useActionState(createUser, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <label htmlFor="new-username" className="block text-xs font-medium text-muted-foreground">
          Username
        </label>
        <input id="new-username" name="username" required className="mt-1 rounded border border-border bg-background px-2.5 py-1.5 text-sm" />
      </div>
      <div>
        <label htmlFor="new-password" className="block text-xs font-medium text-muted-foreground">
          Password
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 rounded border border-border bg-background px-2.5 py-1.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="new-role" className="block text-xs font-medium text-muted-foreground">
          Role
        </label>
        <select id="new-role" name="role" defaultValue="editor" className="mt-1 rounded border border-border bg-background px-2.5 py-1.5 text-sm">
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div>
        <label htmlFor="new-display-name" className="block text-xs font-medium text-muted-foreground">
          Display name
        </label>
        <input
          id="new-display-name"
          name="displayName"
          placeholder="Shown publicly as the author"
          className="mt-1 rounded border border-border bg-background px-2.5 py-1.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="new-job-title" className="block text-xs font-medium text-muted-foreground">
          Job title
        </label>
        <input id="new-job-title" name="jobTitle" className="mt-1 rounded border border-border bg-background px-2.5 py-1.5 text-sm" />
      </div>
      <div className="w-full">
        <label htmlFor="new-bio" className="block text-xs font-medium text-muted-foreground">
          Bio (profile description)
        </label>
        <textarea
          id="new-bio"
          name="bio"
          rows={2}
          className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add user"}
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
