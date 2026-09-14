const STACK = [
  "React 19",
  "TypeScript",
  "Vite",
  "Tailwind CSS v4",
  "shadcn/Radix UI",
  "TanStack Table",
  "Rust",
  "Tauri 2",
  "Tokio",
];

export function TechStack() {
  return (
    <section id="tech" className="border-y-[3px] border-(--color-ink) bg-secondary/40">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-8 text-center text-sm font-bold tracking-widest text-muted-foreground uppercase">
          Built with
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {STACK.map((tech) => (
            <span
              key={tech}
              className="comic-panel-sm rounded-full border-2 border-(--color-ink) bg-card px-4 py-2 text-sm font-bold"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
