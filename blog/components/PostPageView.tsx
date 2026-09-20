import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import type { posts } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { postUrl } from "@/lib/post-url";
import { SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BlogSidebar } from "@/components/BlogSidebar";
import { PostArticle } from "@/components/PostArticle";
import { AuthorCard } from "@/components/AuthorCard";
import { TableOfContents } from "@/components/TableOfContents";
import { CommentSection } from "@/components/CommentSection";
import { parseHeadings } from "@/lib/toc";
import { parseFaqs } from "@/lib/post-sections";

type Post = typeof posts.$inferSelect;

// Shared metadata for a post page, used by both the /<slug> legacy route and
// the canonical /<category>/<slug> route. Next does not merge nested
// openGraph fields, so everything is re-specified here, including a fallback
// og:image for posts without a cover.
export function buildPostMetadata(post: Post): Metadata {
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || undefined;
  const url = postUrl(post);
  const ogImages = post.coverImageKey ? [{ url: post.coverImageKey, alt: post.coverImageAlt ?? title }] : ["/og-image.png"];

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
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.coverImageKey ? [post.coverImageKey] : ["/og-image.png"],
    },
  };
}

async function getAuthor(authorId: number | null) {
  if (!authorId) return null;
  const db = await getDb();
  const [author] = await db.select().from(users).where(eq(users.id, authorId));
  return author ?? null;
}

export async function PostPageView({ post }: { post: Post }) {
  const [author, { items: toc }] = await Promise.all([getAuthor(post.authorId), Promise.resolve(parseHeadings(post.content))]);
  const url = postUrl(post);
  const faqs = parseFaqs(post.faqs);

  const faqSchema = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription || post.excerpt || undefined,
    url,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    image: post.coverImageKey || undefined,
    author: author
      ? { "@type": "Person", name: author.displayName || author.username, url: `${SITE_URL}/author/${author.username}` }
      : { "@type": "Organization", name: "Scary Spider SEO" },
    publisher: { "@type": "Organization", name: "Scary Spider SEO" },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqSchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      ) : null}
      <SiteHeader />

      {/* Two rails on wide screens: the TOC rides in a sticky left column
          (article next to it), with the topic/recent sidebar appearing only
          at xl where there is room for three columns. */}
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:py-16 xl:max-w-[1320px] xl:grid-cols-[240px_minmax(0,1fr)_280px] xl:gap-12">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <PostArticle post={post} />
          {author ? <AuthorCard author={author} /> : null}
          <CommentSection postId={post.id} />
        </div>
        <div className="mt-10 empty:hidden -order-1 lg:order-none lg:col-start-1 lg:row-start-1 lg:mt-0">
          <TableOfContents items={toc} />
        </div>
        <div className="hidden xl:col-start-3 xl:row-start-1 xl:block">
          <BlogSidebar excludeSlug={post.slug} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}