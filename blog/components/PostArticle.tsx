import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { posts } from "@/lib/db/schema";
import { postReadingTime } from "@/lib/reading-time";
import { DEFAULT_CATEGORY } from "@/lib/post-url";
import { parseHeadings } from "@/lib/toc";
import { parseTakeaways, parseFaqs } from "@/lib/post-sections";
import { sanitizePostHtml } from "@/lib/sanitize";

type Post = typeof posts.$inferSelect;

export function PostArticle({ post }: { post: Post }) {
  const { html: contentHtml } = parseHeadings(sanitizePostHtml(post.content));
  const takeaways = parseTakeaways(post.keyTakeaways);
  const faqs = parseFaqs(post.faqs);
  const category = post.category?.trim() || DEFAULT_CATEGORY;

  return (
    <div className="min-w-0">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <>
          <span aria-hidden="true">/</span>
          <Link href={`/?category=${encodeURIComponent(category)}`} className="hover:text-primary">
            {category}
          </Link>
        </>
        <span aria-hidden="true">/</span>
        <span className="min-w-0 truncate text-foreground">{post.title}</span>
      </nav>

      <article className="animate-fade-up mt-6 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{post.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
          {post.publishedAt ? (
            <time dateTime={post.publishedAt.toISOString()}>
              {post.publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </time>
          ) : (
            <span>Not published yet</span>
          )}
          <span aria-hidden="true">/</span>
          <span>{postReadingTime(post.content, post.readingTime)} min read</span>
        </div>

        {post.coverImageKey ? (
          <div className="comic-panel relative mt-8 overflow-hidden rounded-2xl border-2 border-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImageKey}
              alt={post.coverImageAlt ?? ""}
              decoding="async"
              className="w-full"
            />
            <span className="absolute top-3 left-3 rounded-full border-2 border-ink bg-card px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-foreground uppercase">
              {category}
            </span>
          </div>
        ) : null}

        {takeaways.length > 0 ? (
          <div className="comic-panel-sm mt-10 rounded-2xl border-2 border-ink bg-accent/60 p-5">
            <h2 className="font-mono text-xs font-bold tracking-widest text-primary uppercase">Key takeaways</h2>
            <ul className="mt-3.5 space-y-2.5">
              {takeaways.map((takeaway, index) => (
                <li key={index} className="flex gap-3 text-sm">
                  <span className="font-mono text-xs font-bold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="prose prose-brand mt-10 max-w-none" dangerouslySetInnerHTML={{ __html: contentHtml }} />

        {faqs.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
            <div className="mt-6 space-y-3">
              {faqs.map((faq, index) => (
                <details
                  key={index}
                  className="comic-panel-sm group rounded-xl border-2 border-ink bg-card px-5 py-4"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <Plus
                      className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 group-open:rotate-45"
                      weight="bold"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </div>
  );
}
