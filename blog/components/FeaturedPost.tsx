import Link from "next/link";
import { ArrowUpRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { posts } from "@/lib/db/schema";
import { postReadingTime } from "@/lib/reading-time";
import { DEFAULT_CATEGORY, postPath } from "@/lib/post-url";
import { formatPostDate } from "@/components/PostCard";

type Post = typeof posts.$inferSelect;

export function FeaturedPost({ post }: { post: Post }) {
  const href = postPath(post);
  const date = formatPostDate(post.publishedAt);
  const category = post.category?.trim() || DEFAULT_CATEGORY;

  return (
    <article className="comic-panel group relative flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-card">
      <div className="relative flex aspect-[16/8] items-center justify-center overflow-hidden border-b-2 border-ink bg-secondary p-2 sm:aspect-[16/7]">
        {post.coverImageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageKey}
            alt={post.coverImageAlt ?? ""}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="bg-grid-lines flex h-full w-full items-center justify-center text-primary/50">
            <MagnifyingGlass className="h-12 w-12" weight="bold" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full border-2 border-ink bg-primary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-primary-foreground uppercase">
            Latest
          </span>
          <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">{category}</span>
        </div>

        <h2 className="text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl">
          <Link
            href={href}
            className="transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-primary"
          >
            {post.title}
          </Link>
        </h2>

        {post.excerpt ? <p className="line-clamp-3 max-w-[60ch] text-muted-foreground">{post.excerpt}</p> : null}

        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          {date ? <time dateTime={post.publishedAt?.toISOString()}>{date}</time> : <span>Draft</span>}
          <span aria-hidden="true">/</span>
          <span>{postReadingTime(post.content, post.readingTime)} min read</span>
        </div>

        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Read post
          <ArrowUpRight
            className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            weight="bold"
            aria-hidden="true"
          />
        </span>
      </div>
    </article>
  );
}
