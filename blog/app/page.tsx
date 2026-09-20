import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { ArrowLeft, ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { getPostsPerPage } from "@/lib/db/settings";
import { SITE_URL } from "@/lib/site";
import { DEFAULT_CATEGORY, postPath } from "@/lib/post-url";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PostCard } from "@/components/PostCard";
import { FeaturedPost } from "@/components/FeaturedPost";
import { SpiderWebCorner } from "@/components/SpiderWebCorner";
import { BlogSidebar } from "@/components/BlogSidebar";

export const revalidate = 3600;

type HomeSearchParams = { category?: string; q?: string; page?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}): Promise<Metadata> {
  const { category, q, page: pageParam } = await searchParams;

  if (q?.trim()) {
    // Internal search-result pages are thin, near-duplicate content —
    // Google Search Console flags these as low-value "site search" pages,
    // so keep them out of the index even though they're still linkable.
    return { robots: { index: false, follow: true } };
  }

  const page = Math.max(1, Number(pageParam) || 1);
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();

  const titleParts = [category, page > 1 ? `Page ${page}` : null].filter(Boolean);

  return {
    ...(titleParts.length > 0 ? { title: titleParts.join(" · ") } : {}),
    // Next's metadata resolver collapses any canonical whose *path* is "/"
    // down to the bare origin, silently dropping the query string (it only
    // falls back to the full href when the path isn't exactly "/"). So a
    // plain "/" canonical works via this API, but "/?category=..." doesn't
    // — that case is rendered as a manual <link> in the page body instead,
    // which Next/React hoist into <head> just the same.
    ...(qs ? {} : { alternates: { canonical: "/" } }),
  };
}

export default async function BlogHome({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}) {
  const { category, q, page: pageParam } = await searchParams;
  const query = q?.trim();

  const db = await getDb();
  const conditions = [eq(posts.status, "published")];
  if (category) {
    conditions.push(
      category === DEFAULT_CATEGORY ? or(eq(posts.category, category), isNull(posts.category))! : eq(posts.category, category),
    );
  }
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(like(posts.title, pattern), like(posts.excerpt, pattern), like(posts.content, pattern))!);
  }

  const perPage = await getPostsPerPage();
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(posts)
    .where(and(...conditions));
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const published = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.publishedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (query) params.set("q", query);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Scary Spider SEO Blog",
    url: SITE_URL,
    blogPost: published.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: `${SITE_URL}${postPath(post)}`,
      datePublished: post.publishedAt?.toISOString(),
    })),
  };

  // Rendered manually (not via generateMetadata's alternates.canonical)
  // because Next's metadata resolver drops query strings on root-path ("/")
  // canonicals — see the comment in generateMetadata above. React 19 hoists
  // a <link> rendered anywhere in the tree into <head> regardless.
  const canonicalParams = new URLSearchParams();
  if (category) canonicalParams.set("category", category);
  if (page > 1) canonicalParams.set("page", String(page));
  const canonicalQs = canonicalParams.toString();

  // Only promote a selected or newest post to the featured slot on an
  // unfiltered first page; search and category views read better as a uniform list.
  const showFeatured = !category && !query && page === 1 && published.length > 0;
  const featured = showFeatured ? published.find((post) => post.featured) ?? published[0] : null;
  const gridPosts = featured ? published.filter((post) => post.id !== featured.id) : published;

  return (
    <div className="flex min-h-dvh flex-col">
      {canonicalQs ? <link rel="canonical" href={`${SITE_URL}/?${canonicalQs}`} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader defaultQuery={query} />

      <section className="relative overflow-hidden border-b-2 border-ink bg-masthead text-masthead-foreground">
        <div className="bg-dot-grid pointer-events-none absolute inset-0 text-masthead-foreground opacity-[0.14]" aria-hidden="true" />
        <SpiderWebCorner className="absolute top-0 left-0 h-24 w-24 text-masthead-foreground/20" />
        <SpiderWebCorner className="absolute top-0 right-0 h-40 w-40 -scale-x-100 text-masthead-foreground/25 lg:h-56 lg:w-56" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 py-9 sm:px-6 lg:grid-cols-[1fr_auto] lg:py-10">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.2em] text-masthead-foreground/90 uppercase">
              SEO notes
            </p>
            <h1 className="mt-2 max-w-[16ch] text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Notes on crawling the web.
            </h1>
            <p className="mt-3 max-w-[52ch] text-base text-masthead-foreground/90 sm:text-lg">
              SEO, site crawling, and web performance, written by the people building Scary Spider SEO.
            </p>
          </div>
          <div className="comic-wobble relative mx-auto hidden h-36 w-36 shrink-0 sm:block lg:h-44 lg:w-44">
            <div className="absolute inset-0 rounded-full bg-masthead-foreground/10 blur-xl" aria-hidden="true" />
            <Image
              src="/mascot.png"
              alt="The Scary Spider SEO mascot"
              fill
              priority
              className="relative object-contain drop-shadow-2xl"
              sizes="240px"
            />
          </div>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 lg:py-10">
        <div className="min-w-0">
          {category || query ? (
            <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 border-ink bg-card px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {category ? (
                  <>
                    Topic: <span className="font-semibold text-foreground">{category}</span>
                  </>
                ) : null}
                {category && query ? " / " : null}
                {query ? (
                  <>
                    Search: <span className="font-semibold text-foreground">&ldquo;{query}&rdquo;</span>
                  </>
                ) : null}
              </span>
              <Link href="/" className="font-semibold text-primary hover:underline">
                Clear
              </Link>
            </div>
          ) : null}

          {published.length === 0 ? (
            <div className="bg-grid-lines comic-panel-sm flex flex-col items-center rounded-2xl border-2 border-ink bg-card px-6 py-20 text-center">
              <MagnifyingGlass className="h-10 w-10 text-primary" weight="bold" aria-hidden="true" />
              <p className="mt-5 text-lg font-bold">
                {query
                  ? `No posts match "${query}".`
                  : category
                    ? `No posts in "${category}" yet.`
                    : "Nothing published yet."}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {category || query ? (
                  <Link href="/" className="font-semibold text-primary hover:underline">
                    View all posts
                  </Link>
                ) : (
                  "The first post is on its way. Check back soon."
                )}
              </p>
            </div>
          ) : (
            <>
              {featured ? (
                <div className="animate-fade-up">
                  <FeaturedPost post={featured} />
                </div>
              ) : null}

              {gridPosts.length > 0 ? (
                <>
                  {featured ? (
                    <div className="mt-12 mb-6 flex items-center gap-4">
                      <h2 className="text-lg font-bold tracking-tight">More posts</h2>
                      <span className="h-0.5 flex-1 bg-ink" aria-hidden="true" />
                    </div>
                  ) : null}
                  <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
                    {gridPosts.map((post, i) => (
                      <div
                        key={post.id}
                        className="animate-fade-up"
                        style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                      >
                        <PostCard post={post} />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {totalPages > 1 ? (
                <nav
                  aria-label="Pagination"
                  className="mt-12 flex items-center justify-between border-t-2 border-ink pt-6"
                >
                  {page > 1 ? (
                    <Link
                      href={pageHref(page - 1)}
                      className="comic-panel-sm inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-card px-3.5 py-2 text-sm font-semibold"
                    >
                      <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden="true" />
                      Newer
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    Page {page} / {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={pageHref(page + 1)}
                      className="comic-panel-sm inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-card px-3.5 py-2 text-sm font-semibold"
                    >
                      Older
                      <ArrowRight className="h-4 w-4" weight="bold" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              ) : null}
            </>
          )}
        </div>

        <BlogSidebar />
      </main>

      <SiteFooter />
    </div>
  );
}
