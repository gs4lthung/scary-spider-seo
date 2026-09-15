import Link from "next/link";
import { MAIN_SITE_URL } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="comic-wobble inline-block text-lg font-bold tracking-tight">
          Scary Spider SEO <span className="text-primary">Blog</span>
        </Link>
        <a
          href={MAIN_SITE_URL}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Main site
        </a>
      </div>
    </header>
  );
}
