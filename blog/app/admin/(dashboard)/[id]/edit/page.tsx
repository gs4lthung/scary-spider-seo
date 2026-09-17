import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts, categories, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { PostForm } from "@/app/admin/PostForm";
import { updatePost } from "@/app/admin/posts-actions";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [[post], cats, authors, session] = await Promise.all([
    db.select().from(posts).where(eq(posts.id, Number(id))),
    db.select().from(categories),
    db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .orderBy(asc(users.username)),
    getSession(),
  ]);
  if (!post) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-8 text-2xl font-bold">Edit post</h1>
      <PostForm
        action={updatePost.bind(null, post.id)}
        post={post}
        categories={cats}
        authors={authors}
        defaultAuthorId={session?.userId ?? null}
      />
    </div>
  );
}
