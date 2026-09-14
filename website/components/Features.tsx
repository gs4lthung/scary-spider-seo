const FEATURE_GROUPS = [
  {
    title: "Crawling",
    items: [
      "Configurable depth, page limit, and concurrency, with pause/resume and cancel",
      "Optional robots.txt compliance (including Crawl-delay) and an independent politeness delay",
      "Sitemap.xml seeding, redirect-chain tracking, and orphan-page detection",
      "Optional JS rendering via headless Chrome, with an axe-core accessibility audit",
      "Site fingerprinting: server/CDN/CMS detection, llms.txt discovery, hosting/ASN lookup",
    ],
  },
  {
    title: "Auditing",
    items: [
      "25+ built-in issue checks: broken links, missing/duplicate titles & meta descriptions",
      "Title length, H1 issues, canonical problems, insecure links, missing alt text",
      "HSTS, hreflang, and structured data errors, flagged inline in the table",
      "A detail modal per page with plain-language explanations and fixes",
    ],
  },
  {
    title: "Working with results",
    items: [
      "Virtualized tables handle large crawls smoothly, with resizable, sortable columns",
      "The URL column stays pinned while scrolling; any column can be pinned too",
      "Quick text search plus canned filters (status codes, missing titles, duplicates)",
      "Save/load a full crawl snapshot, or export pages and resources to CSV",
    ],
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-14 max-w-2xl">
        <h2 className="text-4xl font-black tracking-tight">
          Everything you need, nothing buried in a PDF.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Every issue shows up inline, right where the page lives, instead
          of in a separate report you have to cross-reference.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {FEATURE_GROUPS.map((group) => (
          <div
            key={group.title}
            className="comic-panel comic-wobble flex flex-col rounded-3xl border-[3px] border-(--color-ink) bg-card p-6"
          >
            <h3 className="mb-4 text-xl font-extrabold text-primary">
              {group.title}
            </h3>
            <ul className="space-y-3 text-sm text-card-foreground/90">
              {group.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="mt-0.5 text-primary">
                    ●
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
