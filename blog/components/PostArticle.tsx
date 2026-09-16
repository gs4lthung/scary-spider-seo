import Link from "next/link";
import type { posts } from "@/lib/db/schema";
import { readingTimeMinutes } from "@/lib/reading-time";
import { parseHeadings } from "@/lib/toc";

type Post = typeof posts.$inferSelect;

export function PostArticle({ post }: { post: Post }) {
  const { html: contentHtml } = parseHeadings(post.content);

  return (
    <div className="min-w-0">
      <nav className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="text-primary" aria-hidden="true">
          ◆
        </span>
        <span className="truncate text-foreground">{post.title}</span>
      </nav>

      <article className="animate-fade-up mt-6 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-px w-6 bg-primary" aria-hidden="true" />
          {post.publishedAt ? (
            <time dateTime={post.publishedAt.toISOString()}>
              {post.publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </time>
          ) : (
            <span>Not published yet</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{readingTimeMinutes(post.content)} min read</span>
        </div>

        {post.coverImageKey ? (
          <div className="comic-panel relative mt-8 overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImageKey} alt={post.coverImageAlt ?? ""} className="w-full" />
            {post.category ? (
              <span className="absolute left-3 top-3 rounded bg-card px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground">
                {post.category}
              </span>
            ) : null}
          </div>
        ) : post.category ? (
          <div className="comic-panel-sm relative mt-8 flex h-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-gradient-to-br from-primary/15 to-accent">
            <span className="rounded bg-card px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground">
              {post.category}
            </span>
          </div>
        ) : null}

        <div className="prose prose-brand mt-10 max-w-none" dangerouslySetInnerHTML={{ __html: contentHtml }} />
      </article>
    </div>
  );
}
