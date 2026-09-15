"use client";

import { useState, type FormEvent } from "react";
import type { AuditResult, CheckStatus } from "@/lib/seo-audit/analyze";

const STATUS_STYLES: Record<CheckStatus, { label: string; className: string }> = {
  pass: { label: "Pass", className: "bg-secondary text-secondary-foreground" },
  warn: { label: "Warning", className: "bg-accent text-accent-foreground" },
  fail: { label: "Fail", className: "bg-primary text-primary-foreground" },
  info: { label: "Info", className: "bg-muted text-muted-foreground" },
};

export function DemoAuditForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/demo/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResult(data as AuditResult);
    } catch {
      setError("Couldn't reach the audit service. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="url"
          placeholder="example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="comic-panel-sm w-full rounded-lg border-2 border-(--color-ink) bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
          aria-label="URL to audit"
        />
        <button
          type="submit"
          disabled={loading}
          className="comic-panel comic-wobble shrink-0 rounded-lg border-2 border-(--color-ink) bg-primary px-6 py-3 font-bold text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Scanning…" : "Audit page"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg border-2 border-(--color-ink) bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-muted-foreground">
            Audited <span className="font-semibold text-foreground">{result.finalUrl}</span>
            {" · "}HTTP {result.status} · {result.timeMs}ms
          </p>
          <ul className="space-y-2">
            {result.checks.map((check) => (
              <li
                key={check.id}
                className="comic-panel-sm flex flex-col gap-2 rounded-lg border-2 border-(--color-ink) bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-bold">{check.label}</p>
                  <p className="text-sm text-muted-foreground">{check.detail}</p>
                </div>
                <span
                  className={`shrink-0 self-start rounded-full border-2 border-(--color-ink) px-3 py-1 text-xs font-bold ${STATUS_STYLES[check.status].className}`}
                >
                  {STATUS_STYLES[check.status].label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
