import type { IconType } from "react-icons";
import {
  SiReact,
  SiTypescript,
  SiVite,
  SiTailwindcss,
  SiShadcnui,
  SiRadixui,
  SiTanstack,
  SiRust,
  SiTauri,
  SiTokio,
} from "react-icons/si";

const STACK: Array<{ label: string; icon: IconType }> = [
  { label: "React 19", icon: SiReact },
  { label: "TypeScript", icon: SiTypescript },
  { label: "Vite", icon: SiVite },
  { label: "Tailwind CSS v4", icon: SiTailwindcss },
  { label: "shadcn/ui", icon: SiShadcnui },
  { label: "Radix UI", icon: SiRadixui },
  { label: "TanStack Table", icon: SiTanstack },
  { label: "Rust", icon: SiRust },
  { label: "Tauri 2", icon: SiTauri },
  { label: "Tokio", icon: SiTokio },
];

export function TechStack() {
  return (
    <section id="tech" className="border-y-[3px] border-(--color-ink) bg-secondary/40">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-8 text-center text-sm font-bold tracking-widest text-muted-foreground uppercase">
          Built with
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {STACK.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="comic-panel-sm flex items-center gap-2 rounded-full border-2 border-(--color-ink) bg-card px-4 py-2 text-sm font-bold"
            >
              <Icon aria-hidden="true" className="h-4.5 w-4.5" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
