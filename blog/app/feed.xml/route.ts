import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site";

// Queries the DB, so it can't be prerendered at build time (a fresh clone,
// CI runner, or wiped local D1 simulator has no tables yet). Runs per
// request on the Worker instead; the Cache-Control header below still
// lets edges/browsers cache it.
export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const db = await getDb();
  const published = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.publishedAt))
    .limit(50);

  const items = published
    .map((post) => {
      const url = `${SITE_URL}/${post.slug}`;
      const description = post.metaDescription || post.excerpt || "";
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${(post.publishedAt ?? post.createdAt).toUTCString()}</pubDate>
      <description>${escapeXml(description)}</description>
      <content:encoded><![CDATA[${post.content}]]></content:encoded>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Scary Spider SEO Blog</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>SEO, site crawling, and web performance notes from the Scary Spider SEO team.</description>
    <language>en-us</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
