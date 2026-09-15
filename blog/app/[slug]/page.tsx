import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { readingTimeMinutes } from "@/lib/reading-time";
import { SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BlogSidebar } from "@/components/BlogSidebar";

export const revalidate = 3600;

async function getPublishedPost(slug: string) {
  const db = await getDb();
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")));
  return post ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return {};

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || undefined;
  const url = `${SITE_URL}/${post.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: post.coverImageKey ? [{ url: post.coverImageKey, alt: post.coverImageAlt ?? title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.coverImageKey ? [post.coverImageKey] : undefined,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription || post.excerpt || undefined,
    url,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    image: post.coverImageKey || undefined,
    author: { "@type": "Organization", name: "Scary Spider SEO" },
    publisher: { "@type": "Organization", name: "Scary Spider SEO" },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-6 py-16 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <nav className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <span className="text-primary" aria-hidden="true">
              ◆
            </span>
            <span className="truncate text-foreground">{post.title}</span>
          </nav>

          <article className="animate-fade-up mt-6 max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-px w-6 bg-primary" aria-hidden="true" />
              {post.publishedAt ? (
                <time dateTime={post.publishedAt.toISOString()}>
                  {post.publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </time>
              ) : null}
              <span aria-hidden="true">·</span>
              <span>{readingTimeMinutes(post.content)} min read</span>
            </div>

            {post.coverImageKey ? (
              <div className="comic-panel relative mt-8 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.coverImageKey} alt={post.coverImageAlt ?? ""} className="w-full" />
                {post.category ? (
                  <span className="absolute left-3 top-3 rounded bg-card px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground">
                    {post.category}
                  </span>
                ) : null}
              </div>
            ) : post.category ? (
              <div className="comic-panel-sm relative mt-8 flex h-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-gradient-to-br from-primary/15 to-accent">
                <span className="rounded bg-card px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground">
                  {post.category}
                </span>
              </div>
            ) : null}

            <div className="prose prose-brand mt-10 max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
          </article>
        </div>

        <BlogSidebar excludeSlug={post.slug} />
      </main>

      <SiteFooter />
    </div>
  );
}
