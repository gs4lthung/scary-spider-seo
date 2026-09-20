import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts, users } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site";
import { postPath } from "@/lib/post-url";

// Queries the DB, so it can't be prerendered at build time (a fresh clone,
// CI runner, or wiped local D1 simulator has no tables yet). Runs per
// request on the Worker instead, which is fast enough for D1.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();
  const published = await db.select().from(posts).where(eq(posts.status, "published"));
  const authors = await db
    .selectDistinct({ username: users.username })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.status, "published"));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...published.map((post) => ({
      url: `${SITE_URL}${postPath(post)}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...authors.map((author) => ({
      url: `${SITE_URL}/author/${author.username}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
