import Image from "next/image";
import Link from "next/link";
import { DownloadSimple, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { MAIN_SITE_URL } from "@/lib/site";

function SearchField({ defaultQuery, id }: { defaultQuery?: string; id: string }) {
  return (
    <form action="/" method="GET" role="search" className="flex w-full items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Search posts
      </label>
      <div className="relative min-w-0 flex-1">
        <MagnifyingGlass
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          weight="bold"
          aria-hidden="true"
        />
        <input
          id={id}
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="Search posts..."
          className="h-10 w-full rounded-full border-2 border-ink bg-card pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <button
        type="submit"
        className="comic-panel-sm h-10 shrink-0 rounded-full border-2 border-ink bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        Search
      </button>
    </form>
  );
}

export function SiteHeader({ defaultQuery }: { defaultQuery?: string } = {}) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Scary Spider SEO Blog home">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-card transition-transform duration-150 group-hover:-rotate-6">
            <Image src="/mascot.png" alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
          </span>
          <span className="text-base font-bold tracking-tight sm:text-lg">
            Scary Spider <span className="text-primary">SEO</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ml-3 hidden items-center gap-0.5 lg:flex">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            All posts
          </Link>
          <Link
            href="/#topics"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Topics
          </Link>
          <Link
            href="/feed.xml"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            RSS
          </Link>
        </nav>

        <div className="ml-auto hidden w-full max-w-[16rem] md:block">
          <SearchField defaultQuery={defaultQuery} id="site-search" />
        </div>

        <a
          href={MAIN_SITE_URL}
          className="comic-wobble ml-auto hidden shrink-0 items-center gap-1.5 rounded-lg border-2 border-ink bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground sm:inline-flex md:ml-2"
        >
          <DownloadSimple className="h-4 w-4" weight="bold" aria-hidden="true" />
          Get the crawler
        </a>

        <a
          href={MAIN_SITE_URL}
          aria-label="Get the free Scary Spider SEO crawler"
          className="comic-panel-sm ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-primary text-primary-foreground sm:hidden"
        >
          <DownloadSimple className="h-5 w-5" weight="bold" aria-hidden="true" />
        </a>
      </div>

      <div className="border-t border-border px-4 pt-2 pb-3 sm:px-6 md:hidden">
        <SearchField defaultQuery={defaultQuery} id="site-search-mobile" />
      </div>
    </header>
  );
}
