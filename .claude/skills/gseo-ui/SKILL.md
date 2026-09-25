---
name: gseo-ui
description: Conventions for the gseo desktop app frontend (React 19, TypeScript, Vite, Tailwind 4, shadcn/radix, TanStack Table + Virtual). Use when building or changing views, tables, dialogs, crawl controls, state in App.tsx, or styling.
---

# Frontend

## Rules

- **`App.tsx` owns crawl state** (pages, resources, progress, site info) and passes it down as props. No global store or context for crawl data. When a task splits `App.tsx`, move logic into hooks/components that still take props; don't introduce a store without an ADR.
- **Batch live updates.** Pages and resources arrive as Tauri events at high rate; they are buffered and flushed in batches (~150 ms). Never `setState` once per event, and never recompute an O(n) derived set per event: use the incremental helpers (`createDuplicateTracker`, `ingestDuplicateValue`).
- **Large crawls are the normal case.** Tables use TanStack Virtual; any new list over ~100 rows must be virtualized. Memoize derived data with `useMemo` keyed on the inputs it actually reads.
- **Classification lives in `src/lib/filters.ts`**, not in components. A component that needs "is this an issue" calls a filter helper.
- **Tauri calls** use `invoke` from `@tauri-apps/api/core` with the command names in `src-tauri/src/lib.rs`; event names are the `crawl://*` constants. `npm run dev` has no backend, so guard UI that assumes one.
- **UI primitives** come from `src/components/ui/` (shadcn, generated: don't hand-edit, add new ones with `npx shadcn add <name>`). Icons from `lucide-react`. Toasts via `sonner`.
- **Styling** uses Tailwind theme tokens and the existing CSS variables in `src/index.css`; both light and dark themes (`next-themes`) must look right. No inline hex colours.
- **Copy:** no em dashes in any user-visible string (see `CLAUDE.md`).
- **Accessibility:** every control has a label, is keyboard operable, and keeps a visible focus ring. This is an accessibility auditor; it should pass its own audit.

## Design

The app is a dense professional tool in the Screaming Frog tradition: information-rich tables, quick filters, a detail pane, no marketing flourishes. Before restyling a screen, load `design-taste-frontend` and `minimalist-ui` if installed; the rules above win where they disagree (density over whitespace, virtualized tables, no heavy animation).

## Testing

- Vitest for pure logic in `src/lib/` (`*.test.ts` next to the file). Build fixtures with a `makePage()` helper like `filters.test.ts`.
- Component logic that grows beyond trivial goes into a pure function in `src/lib/` so it can be tested without a DOM.
- Run: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
