import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SpiderWebCorner } from "@/components/SpiderWebCorner";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <div className="relative">
          <SpiderWebCorner className="absolute -top-8 -left-8 h-24 w-24 text-primary/30" />
          <p className="font-mono text-6xl font-bold tracking-tight text-primary">404</p>
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">This page crawled away.</h1>
        <p className="mt-3 max-w-[46ch] text-muted-foreground">
          The link is broken, or the page was never published. Try the blog index or browse by topic.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="comic-wobble rounded-lg border-2 border-ink bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            Back to the blog
          </Link>
          <Link
            href="/#topics"
            className="comic-panel-sm rounded-lg border-2 border-ink bg-card px-4 py-2 font-semibold"
          >
            Browse topics
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
