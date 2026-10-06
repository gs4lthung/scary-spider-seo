"use client";

import { useEffect, useState } from "react";

// Server action calls (image uploads, post saves, ...) are fetches Next.js
// makes for us. When something in front of the Worker rejects one, typically
// a Cloudflare WAF block page served as a 403, Next only throws a generic
// "unexpected response" error and the HTML that explains why is lost. This
// component wraps window.fetch while the admin is mounted, and when a server
// action request comes back non-OK with an HTML body, shows that HTML in a
// modal along with the status and Cloudflare Ray ID.

type BlockedResponse = {
  status: number;
  url: string;
  rayId: string | null;
  html: string;
};

// Server action calls, plus the image upload endpoint (lib/upload-image.ts).
function isWatchedRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (headers.has("next-action")) return true;
  const url = input instanceof Request ? input.url : input.toString();
  return new URL(url, window.location.href).pathname === "/admin/upload";
}

function findRayId(response: Response, html: string): string | null {
  const header = response.headers.get("cf-ray");
  if (header) return header.split("-")[0];
  const match = html.match(/Ray ID:\s*(?:<[^>]+>\s*)*([0-9a-f]{8,})/i);
  return match ? match[1] : null;
}

export function BlockedResponseModal() {
  const [blocked, setBlocked] = useState<BlockedResponse | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState<"html" | "ray" | null>(null);

  useEffect(() => {
    const originalFetch = window.fetch;
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      try {
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok && contentType.includes("text/html") && isWatchedRequest(input, init)) {
          const html = await response.clone().text();
          setShowSource(false);
          setCopied(null);
          setBlocked({ status: response.status, url: response.url || window.location.href, rayId: findRayId(response, html), html });
        }
      } catch {
        // Diagnostics only: never let the interceptor break the real request.
      }
      return response;
    };
    window.fetch = wrappedFetch;
    return () => {
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (!blocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBlocked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked]);

  if (!blocked) return null;

  const copy = async (what: "html" | "ray", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
      onClick={() => setBlocked(null)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-response-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 id="blocked-response-title" className="text-lg font-semibold">
            Request blocked: HTTP {blocked.status}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The server returned an HTML page instead of a normal response, so the action did not complete. This is
            usually a Cloudflare security rule. Look up the Ray ID under Security, Events in the Cloudflare dashboard.
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Ray ID</dt>
            <dd className="font-mono">{blocked.rayId ?? "not found"}</dd>
            <dt className="text-muted-foreground">URL</dt>
            <dd className="truncate font-mono">{blocked.url}</dd>
          </dl>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-white">
          {showSource ? (
            <pre className="p-4 text-xs whitespace-pre-wrap break-all text-black">{blocked.html}</pre>
          ) : (
            // Empty sandbox: the page renders but its scripts, forms and
            // navigation are disabled.
            <iframe title="Blocked response" sandbox="" srcDoc={blocked.html} className="h-[60vh] w-full border-0" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={() => setShowSource((s) => !s)}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
          >
            {showSource ? "Show page" : "Show HTML source"}
          </button>
          {blocked.rayId ? (
            <button
              type="button"
              onClick={() => copy("ray", blocked.rayId!)}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            >
              {copied === "ray" ? "Copied" : "Copy Ray ID"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => copy("html", blocked.html)}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
          >
            {copied === "html" ? "Copied" : "Copy HTML"}
          </button>
          <button
            type="button"
            onClick={() => setBlocked(null)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
