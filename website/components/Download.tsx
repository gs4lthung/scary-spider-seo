import { LATEST_RELEASE_URL, RELEASES_URL } from "@/lib/site";
import { FiArrowUpRight, FiInfo, FiMonitor, FiTerminal } from "react-icons/fi";
import { FaApple } from "react-icons/fa";

const PLATFORMS = [
  {
    name: "Windows",
    detail: "Portable .zip, or .msi / .exe installer",
    icon: FiMonitor,
    note: "Best for most users",
  },
  {
    name: "macOS",
    detail: "Apple Silicon or Intel .dmg",
    icon: FaApple,
    note: "Intel and Apple Silicon",
  },
  {
    name: "Linux",
    detail: ".AppImage or .deb",
    icon: FiTerminal,
    note: "Portable or packaged",
  },
];

export function Download() {
  return (
    <section id="download" className="mx-auto max-w-6xl px-6 py-24">
      <div className="comic-panel rounded-3xl border-[3px] border-(--color-ink) bg-primary px-6 py-8 text-primary-foreground sm:px-10 sm:py-10 lg:px-14">
        <div className="flex flex-col gap-8 border-b-2 border-primary-foreground/20 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-primary-foreground/70 uppercase">
              Get started
            </p>
            <h2 className="mt-3 text-4xl leading-[1.05] font-black tracking-tight sm:text-5xl">
              No build tools. Just crawl.
            </h2>
            <p className="mt-4 max-w-xl text-primary-foreground/80">
              Download the free, open-source desktop crawler for your operating system.
            </p>
          </div>

          <a
            href={LATEST_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="comic-panel-sm comic-wobble inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-(--color-ink) bg-background px-6 py-3 font-bold text-foreground"
          >
            Get the latest release
            <FiArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {PLATFORMS.map((platform) => (
            <a
              key={platform.name}
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border-2 border-primary-foreground/50 bg-primary-foreground/10 p-5 transition hover:-translate-y-1 hover:bg-primary-foreground/20"
            >
              <div className="flex items-start justify-between gap-3">
                <platform.icon aria-hidden="true" className="h-6 w-6 text-primary-foreground/80" />
                <FiArrowUpRight aria-hidden="true" className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="mt-6 text-lg font-extrabold">{platform.name}</p>
              <p className="mt-1 text-sm text-primary-foreground/75">
                {platform.detail}
              </p>
              <p className="mt-4 font-mono text-[11px] font-bold tracking-wide text-primary-foreground/60 uppercase">
                {platform.note}
              </p>
            </a>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 border-t border-primary-foreground/20 pt-5 text-xs text-primary-foreground/65">
          <FiInfo aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Code signing is not active yet. Windows SmartScreen and macOS Gatekeeper may show a warning before the first run.</p>
        </div>
      </div>
    </section>
  );
}
