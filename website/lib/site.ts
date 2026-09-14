// TODO: no production domain has been chosen yet. Set NEXT_PUBLIC_SITE_URL
// once one exists (Vercel env var, or `website/.env.local` for local builds)
// — until then this placeholder feeds canonical URLs, the sitemap, robots.txt,
// and Open Graph tags, all of which will need re-checking once the real
// domain is live (search-console verification, redirects, etc).
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://scaryspiderseo.example";

export const REPO_URL = "https://github.com/gs4lthung/gseo";
export const RELEASES_URL = `${REPO_URL}/releases`;
export const LATEST_RELEASE_URL = `${REPO_URL}/releases/latest`;

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#tech", label: "Tech stack" },
  { href: "#download", label: "Download" },
] as const;
