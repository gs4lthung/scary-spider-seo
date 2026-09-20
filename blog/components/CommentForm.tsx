"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { PencilSimpleLine, ShieldCheck } from "@phosphor-icons/react";
import { submitComment } from "@/app/comments-actions";

const TURNSTILE_SITE_KEY = "0x4AAAAAAE9tZeVsVwqnGp2Z";
const TURNSTILE_ACTION = "submit_comment";

const REMEMBERED_NAME_KEY = "blog_comment_author";

export function CommentForm({
  postId,
  parentId,
  onCancel,
}: {
  postId: number;
  parentId?: number;
  onCancel?: () => void;
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
      className="comic-panel relative overflow-hidden rounded-2xl border-2 border-ink bg-card p-4 sm:p-5"
    >
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      {/* Folded-corner dog-ear, drawn with the comic ink color so it reads as
          a note that has been dog-eared, not a flat rectangle. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 h-0 w-0 border-t-[28px] border-l-[28px] border-t-ink border-l-transparent"
      />

      <div className="flex flex-wrap items-center gap-2.5 pr-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-primary text-primary-foreground">
          <PencilSimpleLine className="h-4 w-4" weight="bold" aria-hidden="true" />
        </span>
        <h3 className="font-mono text-xs font-bold tracking-widest text-foreground uppercase">
          Leave a comment
        </h3>
        <span className="ml-auto hidden rounded-full border-2 border-ink bg-accent px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-accent-foreground uppercase sm:inline-block">
          Speak up
        </span>
      </div>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Add your perspective to the conversation. Keep it useful and kind.
      </p>

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

      <div className="mt-4 grid gap-4 sm:grid-cols-[190px_1fr]">
        <div>
          <label htmlFor="authorName" className="block text-sm font-semibold">
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
             className="mt-1.5 w-full rounded-lg border-2 border-ink bg-background px-3 py-2 text-sm placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="content" className="block text-sm font-semibold">
            Comment
          </label>
          {/* Ruled notepad field: a repeating hairline every line-height so
              typed text sits on the lines. */}
          <textarea
            id="content"
            name="content"
            required
            rows={4}
            maxLength={3000}
            placeholder="Share your thoughts..."
             className="mt-1.5 w-full rounded-lg border-2 border-ink bg-background px-3 py-2 text-sm leading-7 placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none bg-[repeating-linear-gradient(to_bottom,color-mix(in_oklch,var(--color-ink)_18%,transparent)_0,color-mix(in_oklch,var(--color-ink)_18%,transparent)_1px,transparent_1px,transparent_28px)]"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="comic-wobble rounded-lg border-2 border-ink bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
        >
          {pending ? "Posting..." : parentId ? "Post reply" : "Post comment"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            Cancel
          </button>
        ) : null}
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-action={TURNSTILE_ACTION} />
          <p className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" weight="bold" aria-hidden="true" />
            Checked before it goes live
          </p>
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
