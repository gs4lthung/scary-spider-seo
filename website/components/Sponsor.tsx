import { SPONSOR_URL } from "@/lib/site";
import { CONTACT } from "@/lib/site";
import { CopyEmailButton } from "@/components/CopyEmailButton";
import { FiArrowUpRight, FiHeart, FiLinkedin } from "react-icons/fi";

const LINKEDIN_URL = CONTACT.linkedin;

export function Sponsor() {
  return (
    <section id="contact" className="mx-auto max-w-7xl px-6 py-24">
      <div className="comic-panel grid gap-10 rounded-3xl border-[3px] border-(--color-ink) bg-card px-7 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:px-14 lg:py-14">
        <div>
          <p className="font-mono text-xs font-bold tracking-[0.2em] text-primary uppercase">
            Keep it moving
          </p>
          <h2 className="mt-4 max-w-xl text-4xl leading-[1.05] font-black tracking-tight sm:text-5xl">
            Support the project
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-7 text-muted-foreground">
            Scary Spider SEO is free and open source. If it saves you time, sponsoring helps keep it maintained and moving forward.
          </p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <span>Free to use</span>
            <span>Open source</span>
            <span>Built in public</span>
          </div>
        </div>

        <div className="border-t-2 border-border pt-8 lg:min-w-64 lg:border-t-0 lg:border-l-2 lg:pt-0 lg:pl-10">
          <p className="text-sm font-semibold text-muted-foreground">A small contribution helps fund:</p>
          <ul className="mt-4 space-y-2 text-sm font-medium">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />New crawl checks</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Cross-platform releases</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Long-term maintenance</li>
          </ul>
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noreferrer"
            className="comic-panel comic-wobble mt-7 inline-flex items-center gap-2 rounded-2xl border-2 border-(--color-ink) bg-primary px-5 py-3 font-bold text-primary-foreground"
          >
            <FiHeart aria-hidden="true" className="h-4 w-4 text-red-300" />
            Sponsor on GitHub
            <FiArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </a>

          <div className="mt-10 border-t border-border pt-8">
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-primary uppercase">Get in touch</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Questions, feedback, or just want to say hi? Reach out directly.
            </p>
            <ul className="mt-5 space-y-3">
              <li><CopyEmailButton email={CONTACT.email} /></li>
              <li>
                <a
                  href={LINKEDIN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="comic-panel-sm flex items-center gap-2 rounded-full border-2 border-(--color-ink) bg-secondary px-4 py-2.5 text-sm font-bold text-secondary-foreground"
                >
                  <FiLinkedin aria-hidden="true" className="h-4 w-4 text-primary" />
                  <span className="truncate">/hung-felix-lam</span>
                  <FiArrowUpRight aria-hidden="true" className="ml-auto h-4 w-4 shrink-0" />
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
