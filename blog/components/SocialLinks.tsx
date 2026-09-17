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

export function SocialLinks({ author }: { author: Author }) {
  const email = author.email?.trim();

  return (
    <div className="flex items-center gap-3">
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
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            <Icon className="h-5 w-5" />
          </a>
        );
      })}
      {email ? (
        <a
          href={`mailto:${email}`}
          title="Email"
          aria-label="Email"
          className="text-muted-foreground transition-colors hover:text-primary"
        >
          <EnvelopeSimple className="h-5 w-5" />
        </a>
      ) : null}
    </div>
  );
}