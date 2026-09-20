"use client";

import { useState } from "react";
import { FiMail } from "react-icons/fi";

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fall back to
      // opening the user's mail client instead of silently doing nothing.
      window.location.href = `mailto:${email}`;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-live="polite"
      className="comic-panel-sm comic-wobble flex items-center gap-2 rounded-full border-2 border-(--color-ink) bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground"
    >
      <FiMail aria-hidden="true" className="h-4 w-4 text-primary" />
      <span className="text-primary">Email:</span>
      {copied ? "Copied to clipboard!" : email}
    </button>
  );
}
