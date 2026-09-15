import Image from "next/image";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PostCard } from "@/components/PostCard";
import { SpiderWebCorner } from "@/components/SpiderWebCorner";

export const revalidate = 3600;

export default async function BlogHome({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const db = await getDb();
  const published = await db
    .select()
    .from(posts)
    .where(category ? and(eq(posts.status, "published"), eq(posts.category, category)) : eq(posts.status, "published"))
    .orderBy(desc(posts.publishedAt));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Scary Spider SEO Blog",
    url: SITE_URL,
    blogPost: published.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: `${SITE_URL}/${post.slug}`,
      datePublished: post.publishedAt?.toISOString(),
    })),
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

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

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
        {category ? (
          <p className="mb-8 text-sm text-muted-foreground">
            Filtering by <span className="font-semibold text-foreground">{category}</span>
            {" · "}
            <Link href="/" className="text-primary hover:underline">
              Clear
            </Link>
          </p>
        ) : null}

        {published.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-lg font-semibold">
              {category ? `No posts in "${category}" yet.` : "Nothing published yet."}
            </p>
            <p className="mt-2 text-muted-foreground">
              {category ? (
                <Link href="/" className="text-primary hover:underline">
                  View all posts
                </Link>
              ) : (
                "The first post is on its way. Check back soon."
              )}
            </p>
          </div>
        ) : (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {published.map((post, i) => (
              <div key={post.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                <PostCard post={post} />
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
