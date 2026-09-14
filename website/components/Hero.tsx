import { LATEST_RELEASE_URL, REPO_URL } from "@/lib/site";
import { HeroSpider } from "@/components/HeroSpider";
import { CornerWeb } from "@/components/CornerWeb";

const PILLS = ["Issue detection", "JS rendering", "Accessibility audits"];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b-[3px] border-(--color-ink)">
      <CornerWeb
        corner="top-left"
        size={320}
        className="text-(--color-ink) opacity-[0.16]"
      />
      <CornerWeb
        corner="bottom-right"
        size={220}
        spokes={6}
        rings={4}
        className="text-(--color-ink) opacity-[0.12]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <p className="mb-4 inline-block rounded-full border-2 border-(--color-ink) bg-accent px-3 py-1 text-xs font-bold tracking-wide text-accent-foreground uppercase">
            Free &amp; open source
          </p>
          <h1 className="text-5xl leading-[1.05] font-black tracking-tight text-balance sm:text-6xl">
            The desktop crawler that isn&apos;t afraid to bite bad pages.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Point Scary Spider SEO at a URL, crawl the whole site, and get a
            searchable, sortable table of every page and resource — with
            SEO and accessibility issues flagged inline, not buried in a
            report.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={LATEST_RELEASE_URL}
              target="_blank"
              rel="noreferrer"
              className="comic-panel comic-wobble rounded-2xl border-2 border-(--color-ink) bg-primary px-6 py-3 font-bold text-primary-foreground"
            >
              Download latest release
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="comic-panel comic-wobble rounded-2xl border-2 border-(--color-ink) bg-card px-6 py-3 font-bold"
            >
              View on GitHub
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-2">
            {PILLS.map((pill) => (
              <li
                key={pill}
                className="rounded-full border-2 border-(--color-ink) bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground"
              >
                {pill}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="comic-panel absolute inset-0 -z-10 translate-x-3 translate-y-3 rounded-[2.5rem] bg-primary/20" />
          <div className="comic-panel aspect-square overflow-hidden rounded-[2.5rem] border-[3px] border-(--color-ink) bg-card p-4">
            <HeroSpider />
          </div>
        </div>
      </div>
    </section>
  );
}
