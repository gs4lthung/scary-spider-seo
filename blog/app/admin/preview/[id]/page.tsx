import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BlogSidebar } from "@/components/BlogSidebar";
import { PostArticle } from "@/components/PostArticle";

export default async function PreviewPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, Number(id)));
  if (!post) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center justify-between bg-amber-500 px-6 py-2 text-sm font-semibold text-amber-950">
        <span>
          Preview{post.status === "draft" ? " — this post is a draft and is not live." : " — showing the current saved version."}
        </span>
        <Link href={`/admin/${post.id}/edit`} className="underline hover:no-underline">
          Back to editor
        </Link>
      </div>

      <SiteHeader />

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-6 py-16 lg:grid-cols-[1fr_280px]">
        <PostArticle post={post} />
        <BlogSidebar excludeSlug={post.slug} />
      </main>

      <SiteFooter />
    </div>
  );
}
