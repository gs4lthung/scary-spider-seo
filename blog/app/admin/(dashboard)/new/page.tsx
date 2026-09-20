import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { categories, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { PostForm } from "@/app/admin/PostForm";
import { createPost } from "@/app/admin/posts-actions";

export default async function NewPostPage() {
  const db = await getDb();
  const [cats, authors, session] = await Promise.all([
    db.select().from(categories),
    db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .orderBy(asc(users.username)),
    getCurrentUser(),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-8 text-2xl font-bold">New post</h1>
      <PostForm action={createPost} categories={cats} authors={authors} defaultAuthorId={session?.userId ?? null} />
    </div>
  );
}
