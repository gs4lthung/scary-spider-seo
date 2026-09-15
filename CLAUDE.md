# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a monorepo with three independent projects:

- **`src/` + `src-tauri/`** (this file's directory): the product itself, a Tauri 2 desktop app (React frontend, Rust backend) that crawls a site and audits it for SEO/accessibility issues. Covered by this file.
- **`website/`**: the marketing site (Next.js, deployed to Vercel). Has its own `website/CLAUDE.md`.
- **`blog/`**: the blog + CMS (Next.js on Cloudflare Workers, D1, R2). Has its own `blog/CLAUDE.md`.

CI (`.github/workflows/ci.yml`) path-gates jobs by directory: a `website/`-only change skips the Rust/frontend jobs for the desktop app, and vice versa. `blog/` has no CI job; it's deployed manually via `wrangler`/OpenNext (see `blog/CLAUDE.md`).

## Commands (desktop app: `src/`, `src-tauri/`)

```bash
npm install
npm run tauri dev          # run the full app (frontend + Rust backend)
npm run dev                 # frontend only, in a browser (no crawling — needs the Tauri backend)
npm run build                # tsc + vite build (frontend only)
npm run tauri build          # full release bundle

npm test                     # frontend unit tests (Vitest, single run)
npx vitest run src/lib/filters.test.ts   # single test file
npx vitest run -t "test name"            # single test by name
npm run test:watch           # Vitest watch mode

cd src-tauri && cargo test              # backend unit tests
cd src-tauri && cargo test <substring>  # tests whose name matches <substring>

npm run release              # cuts a version bump + tag (scripts/release.mjs); maintainer only, see root README
```

## Architecture (desktop app)

**Frontend/backend split.** The Rust backend (`src-tauri/src/crawler/`) only fetches and collects raw page/resource data — it does not decide what counts as an "issue." All issue classification (missing titles, duplicate meta, broken canonicals, accessibility violations, etc.) lives in `src/lib/filters.ts` on the frontend, operating on the `PageResult`/`ResourceResult` shapes crawled by Rust and mirrored in `src/types.ts`. When adding a new audit check, decide first whether the raw signal needs to come from Rust (new field on `PageResult`) or can be derived purely from data already crawled (add a filter in `filters.ts`).

**Rust crawler modules** (`src-tauri/src/crawler/`):
- `crawl.rs`: the crawl loop itself (frontier, concurrency, pause/resume/cancel, resource queueing)
- `parse.rs`: HTML parsing/extraction
- `render.rs`: headless Chrome rendering + axe-core accessibility audit for pages with JS rendering enabled
- `robots.rs`, `sitemap.rs`: robots.txt compliance and sitemap.xml seeding
- `techdetect.rs`, `hosting.rs`: server/CDN/CMS fingerprinting and optional hosting/ASN lookup
- `types.rs`: `CrawlConfig`, `PageResult`, `ResourceResult`, `CrawlSnapshot`, etc. (serde types shared with the frontend via Tauri's JSON bridge)

**Frontend/backend communication is event-driven, not request/response.** `start_crawl` (`src-tauri/src/commands.rs`) spawns the crawl as a background task and returns immediately; the frontend gets results by listening for Tauri events registered once on mount in `src/App.tsx`: `crawl://page`, `crawl://resource`, `crawl://site_info`, `crawl://progress`, `crawl://error`, `crawl://done`. Other commands (`stop_crawl`, `pause_crawl`, `resume_crawl`, `get_pages`, `get_resources`, `export_csv`, `save_crawl`, `load_crawl`) are plain request/response. All backend state lives in `AppState` (`src-tauri/src/state.rs`), shared via `Arc`/`Mutex`/`DashMap`/atomics across the async crawl task.

**Resume semantics.** Stopping a crawl with URLs still queued stores a `CrawlResumeState` (`src-tauri/src/state.rs`, `crawl.rs`) keyed by start URL. The next `start_crawl` for the *same* start URL continues from there instead of clearing results; a different start URL, or loading a saved snapshot, discards any stale resume state (`commands.rs::start_crawl`, `load_crawl`).

**Frontend state ownership.** `src/App.tsx` is the single owner of crawl state (pages, resources, progress, site info) and composes the major views (`DataTable`, `DetailModal`, `Overview`, `SiteTree`, `SiteInfoPanel`) as props-down children — there is no separate store/context layer.

## Writing style: no em dashes in public-facing copy

Never use em dashes (—) in text a user, reader, or search engine sees: website copy (`website/`), blog post/reader-facing content (`blog/`), README product descriptions, and GitHub release notes (`.github/workflows/release.yml`).

Why: em dashes read as an AI writing tell in marketing/product copy, and this project's copy has been deliberately reworked to avoid them (see commit "Rework website copy to avoid em dashes"). Google's search snippet generator also tends to rewrite `Brand | Tagline`-style titles into an em-dash form for display, so prefer a colon or restructure the sentence instead of a pipe separator in `<title>` tags.

Use a period, comma, or colon instead of the dash.

This rule does not apply to internal code/doc comments (TS, Rust, CI configs, CONTRIBUTING.md); normal technical writing there is fine.
