const FAQS = [
  {
    q: "Is Scary Spider SEO free?",
    a: "Yes, it's free and open source. Grab a build from the GitHub Releases page for Windows, macOS, or Linux.",
  },
  {
    q: "Does it send my crawl data anywhere?",
    a: "No. It's a native desktop app (Tauri + Rust), so crawling happens locally on your machine and nothing gets uploaded to a server.",
  },
  {
    q: "What platforms are supported?",
    a: "Windows, macOS (both Apple Silicon and Intel), and Linux. Windows also gets a zero-install portable .zip alongside the regular installer.",
  },
  {
    q: "Does it check accessibility, or just SEO?",
    a: "Both. Turning on JS rendering runs an axe-core accessibility audit on the fully rendered page, alongside the SEO checks.",
  },
  {
    q: "How is this different from a hosted/online SEO crawler?",
    a: "It runs locally as a desktop app instead of a hosted SaaS, so there are no page limits, no crawl-credit pricing, and your data never leaves your machine.",
  },
  {
    q: "Can I export the results?",
    a: "Yes, save or load a full crawl snapshot, or export pages and resources to CSV for further analysis.",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

export function FAQ() {
  return (
    <section
      id="faq"
      className="border-y-[3px] border-(--color-ink) bg-secondary/40"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20 lg:py-32">
        <div className="self-start lg:sticky lg:top-28">
          <p className="font-mono text-xs font-bold tracking-[0.2em] text-primary uppercase">
            Quick answers
          </p>
          <h2 className="mt-4 max-w-md text-4xl leading-[1.05] font-black tracking-tight sm:text-5xl">
            Frequently asked questions
          </h2>
          <p className="mt-5 max-w-sm text-muted-foreground">
            Everything you need to know before you point the spider at your first site.
          </p>
          <div className="mt-8 h-1 w-16 bg-primary" aria-hidden="true" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {FAQS.map((f, index) => (
            <details
              key={f.q}
              className="comic-panel-sm group rounded-2xl border-2 border-(--color-ink) bg-card p-5 transition-colors open:bg-primary open:text-primary-foreground"
            >
              <summary className="cursor-pointer list-none font-bold marker:content-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                <span className="flex items-start gap-3">
                  <span className="font-mono text-xs text-primary group-open:text-primary-foreground/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{f.q}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-lg leading-none text-primary transition-transform group-open:rotate-45 group-open:text-primary-foreground"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-4 border-t border-current/20 pt-4 pl-7 text-sm leading-6 text-card-foreground/80 group-open:text-primary-foreground/85">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
