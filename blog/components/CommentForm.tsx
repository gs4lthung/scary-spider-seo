"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitComment } from "@/app/comments-actions";

const REMEMBERED_NAME_KEY = "blog_comment_author";

export function CommentForm({ postId }: { postId: number }) {
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
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="formStartedAt" value={formStartedAt} />
      {/* Honeypot: hidden from real visitors via CSS, not attributes a
          screen reader would also skip, so bots that fill every field trip
          it while sighted or assistive-tech users never see it. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="website">Leave this field blank</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <div>
          <label htmlFor="authorName" className="block text-xs font-medium text-muted-foreground">
            Name
          </label>
          <input
            id="authorName"
            name="authorName"
            required
            maxLength={60}
            defaultValue={rememberedName ?? undefined}
            key={rememberedName}
            placeholder="Your name"
            className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="content" className="block text-xs font-medium text-muted-foreground">
            Comment
          </label>
          <textarea
            id="content"
            name="content"
            required
            rows={3}
            maxLength={3000}
            placeholder="Share your thoughts..."
            className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Posting..." : "Post comment"}
        </button>
        {state && "error" in state ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state && "success" in state ? (
          <p className="text-sm text-muted-foreground">
            {state.pending ? "Thanks! Your comment is awaiting approval." : "Comment posted."}
          </p>
        ) : null}
      </div>
    </form>
  );
}
