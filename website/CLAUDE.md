# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Part of the `gseo` monorepo; see the root `CLAUDE.md` for the overall repo layout and the writing-style rule (no em dashes in public copy) that also applies here.

## Commands

```bash
npm install
npm run dev      # next dev
npm run build    # next build (also what CI runs on any website/** change)
npm run lint     # eslint .
npm run start    # serve a production build locally
```

No test suite in this project; CI (`.github/workflows/ci.yml`, `website` job) only runs `npm run build`.

## Architecture

Next.js App Router marketing site for the desktop app, deployed to Vercel. Independent of `src/`/`src-tauri/`; per the root README and `CONTRIBUTING.md`, it's maintainer-only (no external PRs).

**Maintenance mode.** `middleware.ts` enforces `MAINTENANCE_MODE=true` by rewriting every non-`/maintenance` request to `/maintenance` with a real 503.

**Placeholders to fill in.** `lib/site.ts` has `CONTACT` and `SPONSOR_URL` marked `TODO` with placeholder values; check before treating them as real contact/payment info.

**Icons/SEO metadata** live in `app/layout.tsx` (`metadata.icons`, OpenGraph/Twitter cards, JSON-LD). Favicon PNGs in `public/` are sized as multiples of 48px (`favicon-48/96/192.png`) per Google's favicon indexing guidance, plus `app/favicon.ico` (Next.js special-file convention, auto-served at `/favicon.ico`) as a fallback discovery path.
