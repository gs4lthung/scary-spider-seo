export const SITE_URL = "https://www.scaryspiderseo.com";

export const REPO_URL = "https://github.com/gs4lthung/scary-spider-seo";
export const RELEASES_URL = `${REPO_URL}/releases`;
export const LATEST_RELEASE_URL = `${REPO_URL}/releases/latest`;
export const BLOG_URL =
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://blog.scaryspiderseo.com";

export const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#tech", label: "Tech stack" },
  { href: "#download", label: "Download" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
] as const;

// TODO: placeholders — swap in the real values. Set `phone` to `null` to
// hide that row entirely (e.g. if you decide against listing it publicly).
export const CONTACT = {
  email: "lthung.work.79@gmail.com",
  linkedin: "https://www.linkedin.com/in/hung-felix-lam/",
  phone: null as string | null,
};

// TODO: swap in the real Stripe payment link.
export const SPONSOR_URL = "https://buy.stripe.com/your-link";
