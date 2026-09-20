"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/admin/users-actions";

export function ChangePasswordForm() {
  const [error, formAction, pending] = useActionState(changePassword, null);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      {error ? <p className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div>
        <label htmlFor="current-password" className="block text-sm font-medium">
          Current password
        </label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="new-password" className="block text-sm font-medium">
          New password
        </label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded border px-3 py-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <button type="submit" disabled={pending} className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
        {pending ? "Changing..." : "Change password"}
      </button>
    </form>
  );
}