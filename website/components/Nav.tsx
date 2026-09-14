import Image from "next/image";
import Link from "next/link";
import { LATEST_RELEASE_URL, NAV_LINKS, REPO_URL, SPONSOR_URL } from "@/lib/site";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-(--color-ink) bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/mascot.png" alt="" width={44} height={44} />
          <Image
            src="/logo-wordmark.png"
            alt="Scary Spider SEO"
            width={336}
            height={112}
            className="h-12 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-semibold lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-foreground/80 transition hover:text-primary"
            >
              {link.label}
            </a>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-foreground/80 transition hover:text-primary"
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
            <span aria-hidden="true">♥</span> Sponsor
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
