import Image from "next/image";
import Link from "next/link";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { MAIN_SITE_URL } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-secondary/50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-card">
                <Image src="/mascot.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
              </span>
              <span className="text-lg font-bold tracking-tight">
                Scary Spider <span className="text-primary">SEO</span>
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Notes on crawling, indexing, and web performance from the team building the Scary Spider SEO
              crawler.
            </p>
          </div>

          <nav aria-label="Blog" className="text-sm">
            <h2 className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Read
            </h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/" className="font-medium hover:text-primary">
                  All posts
                </Link>
              </li>
              <li>
                <Link href="/#topics" className="font-medium hover:text-primary">
                  Topics
                </Link>
              </li>
              <li>
                <Link href="/feed.xml" className="font-medium hover:text-primary">
                  RSS feed
                </Link>
              </li>
            </ul>
          </nav>

          <div className="text-sm">
            <h2 className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Crawl your own site
            </h2>
            <p className="mt-4 text-muted-foreground">
              The free desktop crawler that finds every SEO issue on your site.
            </p>
            <a
              href={MAIN_SITE_URL}
              className="comic-wobble mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-primary px-4 py-2 font-semibold text-primary-foreground"
            >
              <DownloadSimple className="h-4 w-4" weight="bold" aria-hidden="true" />
              Get the crawler
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Scary Spider SEO.</p>
          <p className="font-mono text-xs tracking-wide">Crawl. Index. Rank.</p>
        </div>
      </div>
    </footer>
  );
}
