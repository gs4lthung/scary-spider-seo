import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { posts } from "@/lib/db/schema";
import { readingTimeMinutes } from "@/lib/reading-time";
import { postPath } from "@/lib/post-url";

type Post = typeof posts.$inferSelect;

function formatDate(date: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function PostCard({ post }: { post: Post }) {
  const href = postPath(post);
  return (
    <article>
      <Link href={href} className="group block">
        <div className="comic-panel-sm relative aspect-[4/3] overflow-hidden rounded-lg border border-border">
          {post.coverImageKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImageKey}
              alt={post.coverImageAlt ?? ""}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent">
              <MagnifyingGlass className="h-10 w-10 text-primary/40" weight="light" />
            </div>
          )}
          {post.category ? (
            <span className="absolute left-3 top-3 rounded bg-card px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground">
              {post.category}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-px w-6 bg-primary" aria-hidden="true" />
        <span>{formatDate(post.publishedAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{readingTimeMinutes(post.content)} min read</span>
      </div>

      <Link href={href} className="group mt-2 block">
        <h3 className="text-lg font-bold tracking-tight transition-colors group-hover:text-primary">{post.title}</h3>
      </Link>

      <Link
        href={href}
        className="comic-wobble mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary">
          <ArrowRight className="h-3.5 w-3.5" weight="bold" />
        </span>
        Read more
      </Link>
    </article>
  );
}
