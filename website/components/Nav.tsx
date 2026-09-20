import Image from "next/image";
import Link from "next/link";
import { FiHeart } from "react-icons/fi";
import { BLOG_URL, LATEST_RELEASE_URL, REPO_URL, SPONSOR_URL } from "@/lib/site";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-(--color-ink) bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/mascot.png" alt="" width={36} height={36} />
          <Image
            src="/logo-wordmark.png"
            alt="Scary Spider SEO"
            width={336}
            height={112}
            className="h-9 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-semibold lg:flex" aria-label="Primary">
          {[{ href: "#how-it-works", label: "How it works" }, { href: "#features", label: "Features" }, { href: "#download", label: "Download" }].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-foreground/75 transition hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <a
            href={BLOG_URL}
            className="rounded-lg px-3 py-2 text-foreground/75 transition hover:bg-secondary hover:text-foreground"
          >
            Blog
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-2 text-foreground/75 transition hover:bg-secondary hover:text-foreground"
          >
            GitHub
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noreferrer"
            className="comic-panel-sm comic-wobble hidden items-center gap-1.5 rounded-full border-2 border-(--color-ink) bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground sm:flex"
          >
            <FiHeart aria-hidden="true" className="h-4 w-4 text-red-500" /> Sponsor
          </a>
          <a
            href={LATEST_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="comic-panel-sm comic-wobble rounded-full border-2 border-(--color-ink) bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Download
          </a>
        </div>
      </div>
    </header>
  );
}
