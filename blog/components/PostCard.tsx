import Link from "next/link";
import { ArrowUpRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { posts } from "@/lib/db/schema";
import { postReadingTime } from "@/lib/reading-time";
import { DEFAULT_CATEGORY, postPath } from "@/lib/post-url";

type Post = typeof posts.$inferSelect;

export function formatPostDate(date: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function PostCard({ post }: { post: Post }) {
  const href = postPath(post);
  const date = formatPostDate(post.publishedAt);
  const category = post.category?.trim() || DEFAULT_CATEGORY;

  return (
    <article className="group relative flex h-full flex-col">
      <div className="comic-panel-sm relative aspect-[16/10] overflow-hidden rounded-xl border-2 border-ink bg-secondary">
        {post.coverImageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageKey}
            alt={post.coverImageAlt ?? ""}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="bg-grid-lines flex h-full w-full items-center justify-center text-primary/50">
            <MagnifyingGlass className="h-9 w-9" weight="bold" aria-hidden="true" />
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-full border-2 border-ink bg-card px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-foreground uppercase">
          {category}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 font-mono text-xs text-muted-foreground">
        {date ? <time dateTime={post.publishedAt?.toISOString()}>{date}</time> : <span>Draft</span>}
        <span aria-hidden="true">/</span>
        <span>{postReadingTime(post.content, post.readingTime)} min read</span>
      </div>

      <h3 className="mt-2 text-lg leading-snug font-bold tracking-tight text-balance">
        <Link
          href={href}
          className="transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-primary"
        >
          {post.title}
        </Link>
      </h3>

      {post.excerpt ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
      ) : null}

      <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary">
        Read post
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          weight="bold"
          aria-hidden="true"
        />
      </span>
    </article>
  );
}
