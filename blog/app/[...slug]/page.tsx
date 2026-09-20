import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublishedPostBySlug } from "@/lib/db/queries";
import { postPath } from "@/lib/post-url";
import { buildPostMetadata, PostPageView } from "@/components/PostPageView";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug.length !== 1) return {};
  const post = await getPublishedPostBySlug(slug[0]);
  if (!post) return {};
  return buildPostMetadata(post);
}

// Catch-all that owns the legacy flat URLs (everything more specific is
// matched first). A single-segment path is treated as a legacy post URL:
// categorized posts are permanently redirected to /<category>/<slug>, and
// uncategorized posts are still rendered here at /<slug>. Anything deeper
// (or not a known post slug) is a 404.
export default async function LegacyPostPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (slug.length !== 1) notFound();

  const post = await getPublishedPostBySlug(slug[0]);
  if (!post) notFound();

  const canonical = postPath(post);
  if (canonical !== `/${slug[0]}`) permanentRedirect(canonical);

  return <PostPageView post={post} />;
}