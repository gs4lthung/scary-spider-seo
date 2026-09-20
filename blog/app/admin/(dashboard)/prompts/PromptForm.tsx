"use client";

import { useActionState, useState } from "react";
import { updateContentPrompt } from "@/app/admin/settings-actions";

export function PromptForm({ prompt }: { prompt: string }) {
  const [error, formAction, pending] = useActionState(updateContentPrompt, null);
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <form action={formAction} className="max-w-5xl rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Gemini blog writer prompt</h2>
          <p className="mt-1 text-xs text-muted-foreground">Use [INSERT ...] placeholders for the topic-specific details.</p>
        </div>
        <button type="button" onClick={copyPrompt} className="rounded border border-border px-3 py-1.5 text-sm font-semibold hover:bg-secondary">
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
      <textarea
        name="prompt"
        defaultValue={prompt}
        rows={32}
        spellCheck={false}
        className="mt-4 w-full resize-y rounded border border-border bg-background px-3 py-2 font-mono text-xs leading-5"
      />
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {pending ? "Saving..." : "Save prompt"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </form>
  );
}
