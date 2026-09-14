import Image from "next/image";
import { REPO_URL } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t-[3px] border-(--color-ink) bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <Image src="/mascot.png" alt="" width={24} height={24} />
          <span>© {new Date().getFullYear()} Scary Spider SEO</span>
        </div>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-foreground hover:text-primary"
        >
          Source on GitHub ↗
        </a>
      </div>
    </footer>
  );
}
