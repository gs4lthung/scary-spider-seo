import Link from "next/link";
import { getCategoryCounts, getRecentPosts } from "@/lib/db/queries";
import { postPath } from "@/lib/post-url";

export async function BlogSidebar({ excludeSlug }: { excludeSlug?: string }) {
  const [categories, recent] = await Promise.all([getCategoryCounts(), getRecentPosts(excludeSlug ?? "")]);

  if (categories.length === 0 && recent.length === 0) return null;

  return (
    <aside className="space-y-10">
      {categories.length > 0 ? (
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
            <span className="text-primary" aria-hidden="true">
              ◆
            </span>
            Categories
          </h2>
          <ul className="mt-4 space-y-1">
            {categories.map((c) => (
              <li key={c.category}>
                <Link
                  href={`/?category=${encodeURIComponent(c.category)}`}
                  className="flex items-center justify-between border-b border-dotted border-border py-2.5 text-sm hover:text-primary"
                >
                  <span>{c.category}</span>
                  <span className="text-muted-foreground">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
            <span className="text-primary" aria-hidden="true">
              ◆
            </span>
            Recent posts
          </h2>
          <ul className="mt-4 space-y-4">
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={postPath(p)} className="text-sm font-medium hover:text-primary">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
