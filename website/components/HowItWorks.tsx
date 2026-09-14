const STEPS = [
  {
    step: "1",
    title: "Enter a URL",
    body: "Point Scary Spider SEO at any site — no account, no setup, nothing to configure to get started.",
  },
  {
    step: "2",
    title: "It crawls automatically",
    body: "Every internal link, sitemap, and resource gets followed, with robots.txt and Crawl-delay respected by default.",
  },
  {
    step: "3",
    title: "Fix what's flagged",
    body: "SEO and accessibility issues show up inline in the results table — each with a plain-language explanation and fix.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-14 max-w-2xl">
        <h2 className="text-4xl font-black tracking-tight">
          How it works
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          No dashboards to log into, no crawl budget to buy — it runs as a
          desktop app on your own machine.
        </p>
      </div>

      <ol className="grid gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <li
            key={s.step}
            className="comic-panel comic-wobble rounded-3xl border-[3px] border-(--color-ink) bg-card p-6"
          >
            <span className="comic-panel-sm mb-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-(--color-ink) bg-primary text-lg font-black text-primary-foreground">
              {s.step}
            </span>
            <h3 className="mb-2 text-xl font-extrabold">{s.title}</h3>
            <p className="text-sm text-card-foreground/90">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
