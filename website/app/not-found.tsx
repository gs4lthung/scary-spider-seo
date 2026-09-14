import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { REPO_URL } from "@/lib/site";
import { CornerWeb } from "@/components/CornerWeb";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <CornerWeb
        corner="top-left"
        size={280}
        className="text-(--color-ink) opacity-[0.16]"
      />
      <CornerWeb
        corner="bottom-right"
        size={280}
        className="text-(--color-ink) opacity-[0.16]"
      />
      <Image
        src="/mascot.png"
        alt=""
        width={140}
        height={140}
        className="mb-6"
      />
      <p className="text-sm font-bold tracking-widest text-primary uppercase">
        404
      </p>
      <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
        This page got dragged into the web.
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, moved, or got crawled
        away entirely.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="comic-panel comic-wobble rounded-2xl border-2 border-(--color-ink) bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          Back to home
        </Link>
        <a
          href={`${REPO_URL}/issues/new`}
          target="_blank"
          rel="noreferrer"
          className="comic-panel comic-wobble rounded-2xl border-2 border-(--color-ink) bg-card px-6 py-3 font-bold"
        >
          Report a broken link
        </a>
      </div>
    </main>
  );
}
