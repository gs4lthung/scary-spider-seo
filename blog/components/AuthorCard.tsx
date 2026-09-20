import Link from "next/link";
import type { users } from "@/lib/db/schema";
import { SocialLinks } from "@/components/SocialLinks";

type User = typeof users.$inferSelect;

// Author card shown at the foot of a post when it has an author. The name and
// avatar link to the author's profile; the social links sit on their own row
// so they never crowd the name on narrow screens.
export function AuthorCard({ author }: { author: User }) {
  const name = author.displayName || author.username;

  return (
    <div className="comic-panel-sm mt-10 max-w-2xl rounded-2xl border-2 border-ink bg-card p-5">
      <div className="flex items-center gap-4">
        <Link href={`/author/${author.username}`} className="shrink-0">
          {author.avatarKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.avatarKey}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-14 w-14 rounded-full border-2 border-ink object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-primary text-lg font-bold text-primary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </Link>
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Written by
          </p>
          <Link
            href={`/author/${author.username}`}
            className="block truncate text-lg font-bold tracking-tight hover:text-primary"
          >
            {name}
          </Link>
          {author.jobTitle ? <p className="text-sm text-muted-foreground">{author.jobTitle}</p> : null}
        </div>
      </div>

      {author.bio ? <p className="mt-4 text-sm text-muted-foreground">{author.bio}</p> : null}

      <SocialLinks author={author} className="mt-4 border-t border-border pt-4" />
    </div>
  );
}
