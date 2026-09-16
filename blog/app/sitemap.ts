import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site";

// Queries the DB, so it can't be prerendered at build time (a fresh clone,
// CI runner, or wiped local D1 simulator has no tables yet). Runs per
// request on the Worker instead, which is fast enough for D1.
export const dynamic = "force-dynamic";

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
