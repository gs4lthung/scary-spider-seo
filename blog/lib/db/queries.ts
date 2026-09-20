import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./client";
import { categories, posts, users } from "./schema";
import { DEFAULT_CATEGORY } from "@/lib/post-url";

export async function getCategoryCounts(): Promise<{ category: string; count: number }[]> {
  const db = await getDb();
  const categoryLabel = sql<string>`coalesce(${posts.category}, ${DEFAULT_CATEGORY})`;
  const rows = await db
    .select({ category: categoryLabel, count: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.status, "published"))
    .groupBy(categoryLabel)
    .orderBy(desc(sql`count(*)`));
  return rows as { category: string; count: number }[];
}

export async function getRecentPosts(excludeSlug: string, limit = 4) {
  const db = await getDb();
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.status, "published"), ne(posts.slug, excludeSlug)))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}

export async function getPublishedPostBySlug(slug: string) {
  const db = await getDb();
  const [post] = await db.select().from(posts).where(and(eq(posts.slug, slug), eq(posts.status, "published")));
  return post ?? null;
}

export async function getAuthorByUsername(username: string) {
  const db = await getDb();
  const [author] = await db.select().from(users).where(eq(users.username, username));
  return author ?? null;
}

export async function getPublishedPostsByAuthor(authorId: number) {
  const db = await getDb();
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.authorId, authorId), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt));
}

export async function getPostStats() {
  const db = await getDb();
  const [rows, [{ value: categoryCount }]] = await Promise.all([
    db.select({ status: posts.status }).from(posts),
    db.select({ value: sql<number>`count(*)` }).from(categories),
  ]);
  return {
    total: rows.length,
    published: rows.filter((r) => r.status === "published").length,
    draft: rows.filter((r) => r.status === "draft").length,
    categories: categoryCount,
  };
}

export async function getCategoriesWithCounts() {
  const db = await getDb();
  const [cats, postCounts] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.name)),
    db.select({ category: posts.category, count: sql<number>`count(*)` }).from(posts).groupBy(posts.category),
  ]);
  const countByName = new Map(postCounts.map((p) => [p.category, p.count]));
  return cats.map((c) => ({ ...c, postCount: countByName.get(c.name) ?? 0 }));
}
