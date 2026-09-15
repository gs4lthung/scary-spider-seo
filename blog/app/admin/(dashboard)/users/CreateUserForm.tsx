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
