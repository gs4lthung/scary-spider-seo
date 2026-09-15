import { getDb } from "@/lib/db/client";
import { categories } from "@/lib/db/schema";
import { PostForm } from "@/app/admin/PostForm";
import { createPost } from "@/app/admin/posts-actions";

export default async function NewPostPage() {
  const db = await getDb();
  const cats = await db.select().from(categories);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-8 text-2xl font-bold">New post</h1>
      <PostForm action={createPost} categories={cats} />
    </div>
  );
}
