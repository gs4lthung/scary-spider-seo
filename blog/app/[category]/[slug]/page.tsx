import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublishedPostBySlug } from "@/lib/db/queries";
import { postPath } from "@/lib/post-url";
import { buildPostMetadata, PostPageView } from "@/components/PostPageView";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};
  return buildPostMetadata(post);
}

export default async function CategoryPostPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  // Keep the canonical URL canonical: redirect any wrong/legacy category
  // segment (and categorized posts reached without a category) to the real
  // path so one URL per post stays in the index.
  const canonical = postPath(post);
  if (canonical !== `/${category}/${slug}`) permanentRedirect(canonical);

  return <PostPageView post={post} />;
}