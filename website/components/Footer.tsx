import Image from "next/image";
import { BLOG_URL, LATEST_RELEASE_URL, REPO_URL, SPONSOR_URL } from "@/lib/site";
import { FiArrowUpRight, FiHeart } from "react-icons/fi";

export function Footer() {
  return (
    <footer className="border-t-[3px] border-(--color-ink) bg-card">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="comic-panel grid gap-6 rounded-3xl border-[3px] border-(--color-ink) bg-primary px-6 py-7 text-primary-foreground sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-primary-foreground/70 uppercase">Ready to crawl?</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Find what your site is hiding.</h2>
          </div>
          <a
            href={LATEST_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="comic-panel-sm comic-wobble inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-(--color-ink) bg-background px-5 py-3 font-bold text-foreground"
          >
            Download Scary Spider SEO
            <FiArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>

        <div className="grid gap-10 border-b border-border py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <Image src="/mascot.png" alt="" width={36} height={36} />
              <span className="text-lg font-black tracking-tight">Scary Spider <span className="text-primary">SEO</span></span>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              A free desktop crawler for technical SEO, accessibility, and site discovery.
            </p>
          </div>

          <nav aria-label="Product" className="text-sm">
            <h3 className="font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">Product</h3>
            <ul className="mt-4 space-y-3">
              <li><a href="#how-it-works" className="font-medium hover:text-primary">How it works</a></li>
              <li><a href="#features" className="font-medium hover:text-primary">Features</a></li>
              <li><a href="#download" className="font-medium hover:text-primary">Download</a></li>
              <li><a href="#faq" className="font-medium hover:text-primary">FAQ</a></li>
            </ul>
          </nav>

          <nav aria-label="Resources" className="text-sm">
            <h3 className="font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">Resources</h3>
            <ul className="mt-4 space-y-3">
              <li><a href={BLOG_URL} className="font-medium hover:text-primary">SEO blog</a></li>
              <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">GitHub source</a></li>
              <li><a href={`${REPO_URL}/releases`} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">Release notes</a></li>
            </ul>
          </nav>

          <div className="text-sm">
            <h3 className="font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">Support</h3>
            <p className="mt-4 leading-6 text-muted-foreground">Free and open source. If it helps your work, help keep it maintained.</p>
            <a href={SPONSOR_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 font-semibold hover:text-primary">
              <FiHeart aria-hidden="true" className="h-4 w-4 text-red-500" /> Sponsor the project
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Scary Spider SEO</span>
          <span className="font-mono tracking-wide">Crawl. Inspect. Fix.</span>
        </div>
      </div>
    </footer>
  );
}
