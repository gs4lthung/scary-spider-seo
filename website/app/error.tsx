"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <Image
        src="/mascot.png"
        alt=""
        width={140}
        height={140}
        className="mb-6"
      />
      <p className="text-sm font-bold tracking-widest text-primary uppercase">
        Error
      </p>
      <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
        Something bit back.
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Something went wrong loading this page. Try again, or head back
        home.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground/70">
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="comic-panel comic-wobble rounded-2xl border-2 border-(--color-ink) bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          Try again
        </button>
        <Link
          href="/"
          className="comic-panel comic-wobble rounded-2xl border-2 border-(--color-ink) bg-card px-6 py-3 font-bold"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
