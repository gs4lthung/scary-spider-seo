import Link from "next/link";
import type { users } from "@/lib/db/schema";
import { SocialLinks } from "@/components/SocialLinks";

type User = typeof users.$inferSelect;

// Author card shown at the foot of a post when it has an author. The name and
// avatar link to the author's profile; the social links sit next to them (not
// nested inside the link).
export function AuthorCard({ author }: { author: User }) {
  const name = author.displayName || author.username;

  return (
    <div className="mt-10 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        <Link href={`/author/${author.username}`} className="flex min-w-0 flex-1 items-center gap-4">
          {author.avatarKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatarKey} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold hover:text-primary">{name}</p>
            {author.jobTitle ? <p className="text-sm text-muted-foreground">{author.jobTitle}</p> : null}
          </div>
        </Link>
        <SocialLinks author={author} />
      </div>
      {author.bio ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{author.bio}</p> : null}
    </div>
  );
}