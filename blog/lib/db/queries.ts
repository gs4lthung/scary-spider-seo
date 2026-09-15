import { and, asc, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "./client";
import { categories, posts } from "./schema";

export async function getCategoryCounts(): Promise<{ category: string; count: number }[]> {
  const db = await getDb();
  const rows = await db
    .select({ category: posts.category, count: sql<number>`count(*)` })
    .from(posts)
    .where(and(eq(posts.status, "published"), isNotNull(posts.category)))
    .groupBy(posts.category)
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
