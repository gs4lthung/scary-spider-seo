import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();
  const published = await db.select().from(posts).where(eq(posts.status, "published"));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...published.map((post) => ({
      url: `${SITE_URL}/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
