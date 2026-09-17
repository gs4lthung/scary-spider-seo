# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Part of the `gseo` monorepo; see the root `CLAUDE.md` for the overall repo layout and the writing-style rule (no em dashes in public copy, including blog post/reader-facing content) that also applies here.

## Commands

```bash
npm install
npm run dev              # next dev
npm run build            # next build
npm run lint              # eslint .

npm run cf:build          # opennextjs-cloudflare build (Workers-compatible output)
npm run cf:preview        # build + wrangler preview
npm run cf:deploy         # build + deploy to Cloudflare Workers
npm run cf:typegen        # regenerate cloudflare-env.d.ts from wrangler bindings

npm run db:generate        # drizzle-kit generate (new migration from schema changes)
npm run db:migrate:local   # apply migrations to local D1
npm run db:migrate:remote  # apply migrations to remote D1
npm run db:studio          # drizzle-kit studio

npm run admin:hash-password  # scripts/hash-password.mjs, for seeding/resetting a user's passwordHash
```

Not in the root CI workflow (`.github/workflows/ci.yml`); deploys are manual via the `cf:*` scripts above.

## Architecture

Next.js App Router blog + admin CMS, deployed as a Cloudflare Worker via OpenNext (`open-next.config.ts`, `.open-next/` build output). Data lives in Cloudflare D1 (via Drizzle ORM, `lib/db/schema.ts`), media in an R2 bucket. Bindings (`DB`, `MEDIA`, `ASSETS`) are declared in `wrangler.jsonc` and typed in `cloudflare-env.d.ts` (generated) plus `lib/cloudflare-env.d.ts` (hand-written, for `SESSION_SECRET` which is a secret and never appears in `wrangler.jsonc`).

**Schema** (`lib/db/schema.ts`): `posts` (draft/published status, optional `metaTitle`/`metaDescription` overrides that fall back to `title`/`excerpt`), `categories` (a single freeform label per post, not a full taxonomy), `users` (admin/editor role, PBKDF2 password hash).

**Auth is hand-rolled, not a library.** `lib/auth.ts` implements password hashing (PBKDF2 via Web Crypto) and sessions as an HMAC-signed cookie (`SESSION_COOKIE`, not a JWT library) with a 7-day TTL, using only Web Crypto so it can run in Next's edge runtime (`middleware.ts` imports it, which can't resolve `node:crypto`). `middleware.ts` gates every `/admin/*` route: no valid session redirects to `/admin/login`; `/admin/users/*` additionally requires `role === "admin"`. `lib/permissions.ts` defines the admin/editor permission matrix (`can(role, permission)`) for finer-grained checks inside admin pages/actions.

**Content editing.** `components/RichTextEditor.tsx` (Tiptap) is the post body editor; content headings start at H2 since the page title is always the real H1. `lib/seo-limits.ts` deliberately mirrors the desktop crawler's own thresholds (`src/lib/filters.ts::TITLE_MIN_LENGTH`/`TITLE_MAX_LENGTH`) so a post that looks "good" in the admin form also passes a Scary Spider SEO crawl; `app/admin/PostForm.tsx` surfaces these as advisory (non-blocking) title/meta-description length and thin-content warnings.

**Media** (`app/media/[key]/route.ts`): serves R2 objects directly by key with a far-future immutable `Cache-Control` and `ETag`; uploads go through `app/admin/media-actions.ts`. Uploads are re-encoded to WebP client-side (`lib/webp.ts`) before hitting R2; GIF/AVIF pass through unchanged. Deep-dive reference: `TECHNICAL.md`.

**Server actions, not a REST API.** Admin mutations (`app/admin/posts-actions.ts`, `categories-actions.ts`, `users-actions.ts`, `media-actions.ts`) are Next.js server actions called directly from admin components. Most rely solely on `middleware.ts` for access control (any authenticated session). `users-actions.ts` is the exception: since user management is admin-only, every action there calls a local `requireAdmin()` (`lib/session.ts::getSession` + a `role === "admin"` check) rather than trusting the route-level gate alone.
