import Image from "next/image";
import Link from "next/link";
import { CaretDown, DownloadSimple, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { MAIN_SITE_URL } from "@/lib/site";
import { getCategoryCounts } from "@/lib/db/queries";

function SearchField({ defaultQuery, id }: { defaultQuery?: string; id: string }) {
  return (
    <form action="/" method="GET" role="search" className="w-full">
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
          className="h-10 w-full rounded-full border-2 border-ink bg-card pr-11 pl-9 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MagnifyingGlass className="h-4 w-4" weight="bold" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

function TopicMenu({ topics }: { topics: { category: string; count: number }[] }) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&::-webkit-details-marker]:hidden">
        Topics
        <CaretDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" weight="bold" aria-hidden="true" />
      </summary>
      <div className="absolute top-full left-0 z-50 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border-2 border-ink bg-card p-2 shadow-xl">
        {topics.map((topic) => (
          <Link
            key={topic.category}
            href={`/?category=${encodeURIComponent(topic.category)}`}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary hover:text-primary"
          >
            <span className="truncate">{topic.category}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{topic.count}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}

export async function SiteHeader({ defaultQuery }: { defaultQuery?: string } = {}) {
  const topics = await getCategoryCounts();

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
          <TopicMenu topics={topics} />
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

      <div className="border-t border-border px-4 pt-2 pb-2 sm:px-6 md:hidden">
        <SearchField defaultQuery={defaultQuery} id="site-search-mobile" />
        <div className="mt-2">
          <TopicMenu topics={topics} />
        </div>
      </div>
    </header>
  );
}
