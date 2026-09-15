import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts, categories } from "@/lib/db/schema";
import { PostForm } from "@/app/admin/PostForm";
import { updatePost } from "@/app/admin/posts-actions";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [[post], cats] = await Promise.all([
    db.select().from(posts).where(eq(posts.id, Number(id))),
    db.select().from(categories),
  ]);
  if (!post) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-8 text-2xl font-bold">Edit post</h1>
      <PostForm action={updatePost.bind(null, post.id)} post={post} categories={cats} />
    </div>
  );
}
