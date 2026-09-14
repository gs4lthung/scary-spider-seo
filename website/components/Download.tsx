import { LATEST_RELEASE_URL, RELEASES_URL } from "@/lib/site";

const PLATFORMS = [
  {
    name: "Windows",
    detail: "Portable .zip, or .msi / .exe installer",
  },
  {
    name: "macOS",
    detail: "Apple Silicon or Intel .dmg",
  },
  {
    name: "Linux",
    detail: ".AppImage or .deb",
  },
];

export function Download() {
  return (
    <section id="download" className="mx-auto max-w-6xl px-6 py-24">
      <div className="comic-panel rounded-3xl border-[3px] border-(--color-ink) bg-primary px-8 py-14 text-primary-foreground sm:px-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-black tracking-tight">
            No build tools. No install wizard. Just crawl.
          </h2>
          <p className="mt-4 text-primary-foreground/80">
            Grab a build for your OS from the Releases page — free and open
            source.
          </p>

          <a
            href={LATEST_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="comic-panel-sm comic-wobble mt-8 inline-block rounded-2xl border-2 border-(--color-ink) bg-background px-8 py-3 font-bold text-foreground"
          >
            Get the latest release
          </a>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {PLATFORMS.map((platform) => (
            <a
              key={platform.name}
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="comic-wobble rounded-2xl border-2 border-(--color-ink) bg-background/10 p-5 text-center backdrop-blur-sm transition hover:bg-background/20"
            >
              <p className="text-lg font-extrabold">{platform.name}</p>
              <p className="mt-1 text-sm text-primary-foreground/75">
                {platform.detail}
              </p>
            </a>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-primary-foreground/60">
          Builds aren&apos;t code-signed yet — Windows SmartScreen and macOS
          Gatekeeper will warn before the first run.
        </p>
      </div>
    </section>
  );
}
