import Link from "next/link";
import { MAIN_SITE_URL } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Scary Spider SEO.</p>
        <div className="flex items-center gap-4">
          <Link href="/feed.xml" className="hover:text-foreground hover:underline">
            RSS
          </Link>
          <a href={MAIN_SITE_URL} className="hover:text-foreground hover:underline">
            Free desktop SEO crawler, get it here
          </a>
        </div>
      </div>
    </footer>
  );
}
