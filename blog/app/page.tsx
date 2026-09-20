import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { getPostsPerPage } from "@/lib/db/settings";
import { SITE_URL } from "@/lib/site";
import { postPath } from "@/lib/post-url";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PostCard } from "@/components/PostCard";
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
  if (category) conditions.push(eq(posts.category, category));
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

  return (
    <div className="flex min-h-dvh flex-col">
      {canonicalQs ? <link rel="canonical" href={`${SITE_URL}/?${canonicalQs}`} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader defaultQuery={query} />

      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="bg-dot-grid absolute inset-0" aria-hidden="true" />
        <SpiderWebCorner className="absolute top-0 left-0 h-28 w-28 text-primary-foreground/20" />
        <SpiderWebCorner className="absolute top-0 right-0 h-48 w-48 -scale-x-100 text-primary-foreground/25 lg:h-64 lg:w-64" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-primary-foreground/70">
              <span aria-hidden="true">◆</span> SEO NOTES <span aria-hidden="true">◆</span>
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Notes on crawling the web.</h1>
            <p className="mt-4 max-w-[52ch] text-lg text-primary-foreground/85">
              SEO, site crawling, and web performance, written by the people building Scary Spider SEO.
            </p>
          </div>
          <div className="comic-wobble relative mx-auto hidden h-56 w-56 shrink-0 sm:block lg:h-72 lg:w-72">
            <div className="absolute inset-0 rounded-full bg-primary-foreground/10 blur-xl" aria-hidden="true" />
            <Image
              src="/mascot.png"
              alt="The Scary Spider SEO mascot"
              fill
              priority
              className="relative object-contain drop-shadow-2xl"
              sizes="288px"
            />
          </div>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-6 py-16 lg:grid-cols-[1fr_280px]">
        <div>
          {category || query ? (
            <p className="mb-8 text-sm text-muted-foreground">
              {category ? (
                <>
                  Filtering by <span className="font-semibold text-foreground">{category}</span>
                </>
              ) : null}
              {category && query ? " · " : null}
              {query ? (
                <>
                  Results for <span className="font-semibold text-foreground">&ldquo;{query}&rdquo;</span>
                </>
              ) : null}
              {" · "}
              <Link href="/" className="text-primary hover:underline">
                Clear
              </Link>
            </p>
          ) : null}

          {published.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-lg font-semibold">
                {query
                  ? `No posts match "${query}".`
                  : category
                    ? `No posts in "${category}" yet.`
                    : "Nothing published yet."}
              </p>
              <p className="mt-2 text-muted-foreground">
                {category || query ? (
                  <Link href="/" className="text-primary hover:underline">
                    View all posts
                  </Link>
                ) : (
                  "The first post is on its way. Check back soon."
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
                {published.map((post, i) => (
                  <div key={post.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                    <PostCard post={post} />
                  </div>
                ))}
              </div>

              {totalPages > 1 ? (
                <nav aria-label="Pagination" className="mt-12 flex items-center justify-between border-t border-border pt-6">
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)} className="text-sm font-medium text-primary hover:underline">
                      ← Newer posts
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link href={pageHref(page + 1)} className="text-sm font-medium text-primary hover:underline">
                      Older posts →
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
