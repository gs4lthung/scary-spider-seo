const FAQS = [
  {
    q: "Is Scary Spider SEO free?",
    a: "Yes — it's free and open source. Grab a build from the GitHub Releases page for Windows, macOS, or Linux.",
  },
  {
    q: "Does it send my crawl data anywhere?",
    a: "No. It's a native desktop app (Tauri + Rust) — crawling happens locally on your machine, and nothing gets uploaded to a server.",
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
    a: "It runs locally as a desktop app instead of a hosted SaaS — no page limits, no crawl-credit pricing, and your data never leaves your machine.",
  },
  {
    q: "Can I export the results?",
    a: "Yes — save or load a full crawl snapshot, or export pages and resources to CSV for further analysis.",
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
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="mb-10 text-center text-4xl font-black tracking-tight">
          Frequently asked questions
        </h2>

        <div className="space-y-4">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="comic-panel-sm group rounded-2xl border-2 border-(--color-ink) bg-card p-5 open:pb-5"
            >
              <summary className="cursor-pointer list-none font-bold marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-primary transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-card-foreground/90">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
