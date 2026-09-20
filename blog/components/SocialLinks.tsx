import {
  EnvelopeSimple,
  FacebookLogo,
  GithubLogo,
  GlobeSimple,
  LinkedinLogo,
  XLogo,
} from "@phosphor-icons/react/dist/ssr";

type Author = {
  website: string | null;
  email: string | null;
  github: string | null;
  twitter: string | null;
  linkedin: string | null;
  facebook: string | null;
};

// Turns a bare handle ("facebook.com/name") or full URL into an http(s) URL;
// email addresses are rendered separately as a mailto: link.
function toUrl(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

const LINKS = [
  { key: "website", label: "Website", Icon: GlobeSimple },
  { key: "github", label: "GitHub", Icon: GithubLogo },
  { key: "twitter", label: "X (Twitter)", Icon: XLogo },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedinLogo },
  { key: "facebook", label: "Facebook", Icon: FacebookLogo },
] as const;

export function SocialLinks({ author, className }: { author: Author; className?: string }) {
  const email = author.email?.trim();
  const hasLinks = LINKS.some(({ key }) => toUrl(author[key]));
  if (!hasLinks && !email) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      {LINKS.map(({ key, label, Icon }) => {
        const href = toUrl(author[key]);
        if (!href) return null;
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            title={label}
            aria-label={label}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-card text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </a>
        );
      })}
      {email ? (
        <a
          href={`mailto:${email}`}
          title="Email"
          aria-label="Email"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-card text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <EnvelopeSimple className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}
