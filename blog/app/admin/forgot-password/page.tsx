"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/admin/password-reset-actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Enter your login email and we&apos;ll send you a link to choose a new password.
      </p>
      <form action={formAction} className="space-y-4">
        {state ? (
          <p
            className={
              state.error
                ? "rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700"
                : "rounded border border-green-400 bg-green-50 p-3 text-sm text-green-800"
            }
          >
            {state.message}
          </p>
        ) : null}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Login email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="comic-panel w-full rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <Link href="/admin/login" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
        Back to sign in
      </Link>
    </main>
  );
}
