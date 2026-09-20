import { SPONSOR_URL } from "@/lib/site";

export function Sponsor() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="comic-panel rounded-3xl border-[3px] border-(--color-ink) bg-card px-8 py-14 text-center sm:px-14">
        <h2 className="text-4xl font-black tracking-tight">
          Support the project
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Scary Spider SEO is free and open source. If it saves you time,
          sponsoring helps keep it maintained and moving forward.
        </p>

        <a
          href={SPONSOR_URL}
          target="_blank"
          rel="noreferrer"
          className="comic-panel comic-wobble mt-8 inline-block rounded-2xl border-2 border-(--color-ink) bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          ♥ Sponsor on GitHub
        </a>
      </div>
    </section>
  );
}
