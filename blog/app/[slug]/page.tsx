import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublishedPostBySlug } from "@/lib/db/queries";
import { postPath } from "@/lib/post-url";
import { buildPostMetadata, PostPageView } from "@/components/PostPageView";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};
  return buildPostMetadata(post);
}

// Legacy flat URL. Categorized posts now live at /<category>/<slug>, so any
// post with a category is permanently redirected to its canonical path here;
// uncategorized posts are still rendered at /<slug>.
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const canonical = postPath(post);
  if (canonical !== `/${slug}`) permanentRedirect(canonical);

  return <PostPageView post={post} />;
}