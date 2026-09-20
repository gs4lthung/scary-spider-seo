const STEPS = [
  {
    step: "1",
    label: "Input",
    title: "Enter a URL",
    body: "Point Scary Spider SEO at any site. No account, no setup, nothing to configure to get started.",
  },
  {
    step: "2",
    label: "Process",
    title: "It crawls automatically",
    body: "Every internal link, sitemap, and resource gets followed, with robots.txt and Crawl-delay respected by default.",
  },
  {
    step: "3",
    label: "Outcome",
    title: "Fix what's flagged",
    body: "SEO and accessibility issues show up inline in the results table, each with a plain-language explanation and fix.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
        <div className="self-start lg:sticky lg:top-28">
          <p className="font-mono text-xs font-bold tracking-[0.2em] text-primary uppercase">
            A simple workflow
          </p>
          <h2 className="mt-4 text-4xl leading-[1.05] font-black tracking-tight sm:text-5xl">
          How it works
          </h2>
          <p className="mt-5 max-w-sm text-lg leading-7 text-muted-foreground">
            No dashboards to log into, no crawl budget to buy. It runs as a desktop app on your own machine.
          </p>
          <div className="mt-8 h-1 w-16 bg-primary" aria-hidden="true" />
        </div>

        <ol className="border-l-2 border-border">
          {STEPS.map((s, index) => (
            <li key={s.step} className={`relative pl-8 ${index < STEPS.length - 1 ? "pb-10" : ""}`}>
              <span className="absolute top-0 -left-[1.15rem] flex h-8 w-8 items-center justify-center rounded-full border-2 border-(--color-ink) bg-primary text-sm font-black text-primary-foreground shadow-[2px_2px_0_var(--color-ink)]">
                {s.step}
              </span>
              <p className="font-mono text-xs font-bold tracking-[0.18em] text-primary uppercase">{s.label}</p>
              <h3 className="mt-3 text-2xl font-extrabold tracking-tight">{s.title}</h3>
              <p className="mt-3 max-w-2xl leading-7 text-card-foreground/80">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
