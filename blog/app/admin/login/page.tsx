"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-bold">Admin login</h1>
      <form action={formAction} className="space-y-4">
        {error ? <p className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div>
          <label htmlFor="username" className="block text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            name="username"
            required
            autoFocus
            autoComplete="username"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="comic-panel w-full rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
