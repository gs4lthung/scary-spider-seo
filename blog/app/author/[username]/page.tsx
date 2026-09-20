import type { Metadata } from "next";
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
        <div className="flex items-center gap-5">
          {author.avatarKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatarKey} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
            {author.jobTitle ? <p className="mt-1 text-muted-foreground">{author.jobTitle}</p> : null}
            <div className="mt-2">
              <SocialLinks author={author} />
            </div>
          </div>
        </div>

        {author.bio ? <p className="mt-5 max-w-2xl text-muted-foreground">{author.bio}</p> : null}

        <h2 className="mt-14 text-sm font-semibold text-muted-foreground">Posts by {name}</h2>
        {posts.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No published posts yet.</p>
        ) : (
          <div className="mt-6 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
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