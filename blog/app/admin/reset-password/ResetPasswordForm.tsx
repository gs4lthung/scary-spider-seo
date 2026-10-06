"use client";

import { useActionState } from "react";
import { resetPassword } from "@/app/admin/password-reset-actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(resetPassword, null);

  return (
    <form action={formAction} className="space-y-4">
      {error ? <p className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoFocus
          autoComplete="new-password"
          className="mt-1 w-full rounded border px-3 py-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="comic-panel w-full rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}
