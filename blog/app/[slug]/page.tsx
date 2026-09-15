import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BlogSidebar } from "@/components/BlogSidebar";
import { PostArticle } from "@/components/PostArticle";

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
        <PostArticle post={post} />
        <BlogSidebar excludeSlug={post.slug} />
      </main>

      <SiteFooter />
    </div>
  );
}
