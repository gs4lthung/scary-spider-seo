import Link from "next/link";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { getCategoryCounts, getRecentPosts } from "@/lib/db/queries";
import { postPath } from "@/lib/post-url";
import { MAIN_SITE_URL } from "@/lib/site";

export async function BlogSidebar({ excludeSlug }: { excludeSlug?: string }) {
  const [categories, recent] = await Promise.all([getCategoryCounts(), getRecentPosts(excludeSlug ?? "")]);

  return (
    <aside className="space-y-6">
      {categories.length > 0 ? (
        <section id="topics" className="scroll-mt-24 rounded-2xl border-2 border-ink bg-card p-5">
          <h2 className="font-mono text-xs font-bold tracking-widest text-muted-foreground uppercase">Topics</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.category}>
                <Link
                  href={`/?category=${encodeURIComponent(c.category)}`}
                  className="group inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {c.category}
                  <span className="font-mono text-xs text-muted-foreground group-hover:text-primary-foreground/80">
                    {c.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="rounded-2xl border-2 border-ink bg-card p-5">
          <h2 className="font-mono text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Recent posts
          </h2>
          <ol className="mt-4 space-y-3.5">
            {recent.map((p, index) => (
              <li key={p.id} className="flex gap-3">
                <span className="font-mono text-xs font-bold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Link href={postPath(p)} className="text-sm leading-snug font-medium hover:text-primary">
                  {p.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="comic-panel rounded-2xl border-2 border-ink bg-masthead p-5 text-masthead-foreground">
        <h2 className="text-base font-bold">Audit your own site</h2>
        <p className="mt-2 text-sm text-masthead-foreground/90">
          Crawl every page, catch broken canonicals, thin content, and accessibility issues before Google does.
        </p>
        <a
          href={MAIN_SITE_URL}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-masthead-foreground px-3.5 py-2 text-sm font-semibold text-masthead"
        >
          <DownloadSimple className="h-4 w-4" weight="bold" aria-hidden="true" />
          Get the crawler
        </a>
      </section>
    </aside>
  );
}
