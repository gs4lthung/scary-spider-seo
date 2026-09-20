import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { MAIN_SITE_URL } from "@/lib/site";

export function SiteHeader({ defaultQuery }: { defaultQuery?: string } = {}) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link href="/" className="comic-wobble inline-block shrink-0 text-lg font-bold tracking-tight">
          Scary Spider SEO <span className="text-primary">Blog</span>
        </Link>
        <form action="/" method="GET" role="search" className="order-3 flex w-full sm:order-2 sm:w-auto sm:flex-1 sm:max-w-xs">
          <label htmlFor="site-search" className="sr-only">
            Search posts
          </label>
          <input
            id="site-search"
            type="search"
            name="q"
            defaultValue={defaultQuery}
            placeholder="Search posts..."
            className="w-full rounded-l border border-r-0 border-border bg-background px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex shrink-0 items-center justify-center rounded-r border border-primary bg-primary px-3 text-primary-foreground hover:bg-primary/90"
          >
            <MagnifyingGlass className="h-4 w-4" weight="bold" aria-hidden="true" />
          </button>
        </form>
        <a
          href={MAIN_SITE_URL}
          className="order-2 shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:order-3"
        >
          Main site
        </a>
      </div>
    </header>
  );
}
