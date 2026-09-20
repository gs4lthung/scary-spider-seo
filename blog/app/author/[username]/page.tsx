import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthorByUsername, getPublishedPostsByAuthor } from "@/lib/db/queries";
import { SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PostCard } from "@/components/PostCard";
import { SocialLinks } from "@/components/SocialLinks";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const author = await getAuthorByUsername(username);
  if (!author) return {};

  const name = author.displayName || author.username;
  return {
    title: `${name} - Scary Spider SEO Blog`,
    description: author.bio ?? undefined,
    alternates: { canonical: `${SITE_URL}/author/${author.username}` },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const author = await getAuthorByUsername(username);
  if (!author) notFound();

  const posts = await getPublishedPostsByAuthor(author.id);
  const name = author.displayName || author.username;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 lg:py-16">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-foreground">Author</span>
        </nav>

        <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          {author.avatarKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.avatarKey}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full border-2 border-ink object-cover"
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-primary text-2xl font-bold text-primary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Author
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{name}</h1>
            {author.jobTitle ? <p className="mt-1 text-muted-foreground">{author.jobTitle}</p> : null}
            <SocialLinks author={author} className="mt-3" />
          </div>
        </header>

        {author.bio ? <p className="mt-6 max-w-2xl text-muted-foreground">{author.bio}</p> : null}

        <div className="mt-12 mb-6 flex items-center gap-4">
          <h2 className="text-lg font-bold tracking-tight">Posts by {name}</h2>
          <span className="h-0.5 flex-1 bg-ink" aria-hidden="true" />
        </div>

        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published posts yet.</p>
        ) : (
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
