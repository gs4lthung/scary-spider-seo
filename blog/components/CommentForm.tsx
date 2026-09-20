"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { ShieldCheck, User } from "@phosphor-icons/react";
import { submitComment } from "@/app/comments-actions";

const TURNSTILE_ACTION = "submit_comment";

const REMEMBERED_NAME_KEY = "blog_comment_author";

export function CommentForm({
  postId,
  parentId,
  onCancel,
  turnstileSiteKey,
}: {
  postId: number;
  parentId?: number;
  onCancel?: () => void;
  turnstileSiteKey: string;
}) {
  const [state, formAction, pending] = useActionState(submitComment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [rememberedName, setRememberedName] = useState<string | null>(null);
  const [formStartedAt] = useState(() => Date.now());

  useEffect(() => {
    try {
      setRememberedName(localStorage.getItem(REMEMBERED_NAME_KEY));
    } catch {
      // Private browsing / storage disabled — just skip the convenience.
    }
  }, []);

  useEffect(() => {
    if (state && "success" in state) {
      const nameInput = formRef.current?.elements.namedItem("authorName") as HTMLInputElement | null;
      const name = nameInput?.value;
      if (name) {
        try {
          localStorage.setItem(REMEMBERED_NAME_KEY, name);
        } catch {
          // Ignore — nothing to remember it with.
        }
      }
      formRef.current?.reset();
      if (window.turnstile) {
        window.turnstile.reset();
      }
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border-2 border-ink bg-card p-4 transition-shadow duration-200 focus-within:ring-4 focus-within:ring-primary/15 sm:p-5"
    >
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />

      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <input type="hidden" name="formStartedAt" value={formStartedAt} />
      {/* Honeypot: hidden from real visitors via CSS, not attributes a
          screen reader would also skip, so bots that fill every field trip
          it while sighted or assistive-tech users never see it. */}
      <div className="pointer-events-none absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="website">Leave this field blank</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-accent text-accent-foreground">
          <User className="h-4 w-4" weight="bold" aria-hidden="true" />
        </span>
        <label htmlFor="authorName" className="sr-only">
          Your name
        </label>
        <input
          id="authorName"
          name="authorName"
          required
          maxLength={60}
          defaultValue={rememberedName ?? undefined}
          key={rememberedName}
          placeholder="Your name"
          className="w-full min-w-0 border-0 bg-transparent text-sm font-bold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <label htmlFor="content" className="sr-only">
        Comment
      </label>
      <textarea
        id="content"
        name="content"
        required
        rows={3}
        maxLength={3000}
        placeholder="Share your thoughts..."
        className="mt-3 w-full resize-none border-0 bg-transparent text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
      />

      <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Turnstile stays invisible until it actually needs the visitor to do
            something, so the common case is just our own trust line below,
            not a foreign widget box stapled onto the UI. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div
            className="cf-turnstile"
            data-sitekey={turnstileSiteKey}
            data-action={TURNSTILE_ACTION}
            data-appearance="interaction-only"
            data-size="flexible"
          />
          <p className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" weight="bold" aria-hidden="true" />
            Checked before it goes live
          </p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          {onCancel ? (
            <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border-2 border-ink bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Posting..." : parentId ? "Post reply" : "Comment"}
          </button>
        </div>
      </div>

      {state && "error" in state ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      {state && "success" in state ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {state.pending ? "Thanks! Your comment is awaiting approval." : "Comment posted."}
        </p>
      ) : null}
    </form>
  );
}
