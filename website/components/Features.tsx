import { FiAlertTriangle, FiBarChart2, FiCompass } from "react-icons/fi";

const FEATURE_GROUPS = [
  {
    title: "Crawling",
    eyebrow: "01 / Discover",
    icon: FiCompass,
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
    eyebrow: "02 / Diagnose",
    icon: FiAlertTriangle,
    items: [
      "25+ built-in issue checks: broken links, missing/duplicate titles & meta descriptions",
      "Title length, H1 issues, canonical problems, insecure links, missing alt text",
      "HSTS, hreflang, and structured data errors, flagged inline in the table",
      "A detail modal per page with plain-language explanations and fixes",
    ],
  },
  {
    title: "Working with results",
    eyebrow: "03 / Act",
    icon: FiBarChart2,
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
      <div className="mb-14 max-w-3xl">
        <p className="font-mono text-xs font-bold tracking-[0.2em] text-primary uppercase">
          One workspace, every issue
        </p>
        <h2 className="mt-4 text-4xl leading-[1.05] font-black tracking-tight sm:text-5xl">
          Everything you need, nothing buried in a PDF.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Every issue shows up inline, right where the page lives, instead
          of in a separate report you have to cross-reference.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        {FEATURE_GROUPS.map(({ icon: Icon, ...group }, index) => (
          <div
            key={group.title}
            className={`comic-panel flex flex-col rounded-3xl border-[3px] border-(--color-ink) bg-card p-6 sm:p-7 ${index === 2 ? "lg:col-span-2" : ""}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-primary uppercase">
                  {group.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-extrabold tracking-tight">
                  {group.title}
                </h3>
              </div>
              <Icon aria-hidden="true" className="h-7 w-7 shrink-0 text-primary" />
            </div>
            <ul className={`mt-6 grid gap-x-8 gap-y-4 text-sm leading-6 text-card-foreground/90 ${index === 2 ? "sm:grid-cols-2" : ""}`}>
              {group.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
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
