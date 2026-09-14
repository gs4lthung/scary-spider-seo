# Contributing to Scary Spider SEO

Thanks for wanting to help out — bug reports, fixes, and features are all
welcome via pull request.

## Before you start

- For anything beyond a small fix, open an issue first to discuss the
  approach. Saves everyone from a rewritten PR.
- Keep PRs focused — one fix or feature per PR.

## Development setup

Prerequisites: [Node.js](https://nodejs.org/), [Rust](https://www.rust-lang.org/tools/install),
and the [Tauri system dependencies](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run tauri dev
```

`npm run dev` runs just the frontend in a browser for UI-only iteration —
crawling requires the Tauri backend.

## Testing

```bash
npm test                     # frontend (Vitest)
cd src-tauri && cargo test   # backend (Rust)
```

Please add or update tests for behavior changes.

## The website

`website/` is a separate Next.js project for the marketing site — its own
`package.json`, independent of the app. See [`website/README.md`](website/README.md)
to run it.

## Pull requests

- Branch off `main`, keep commits focused, and describe what changed and
  how you tested it.
- CI must pass before merge.

## Releases

Releases are cut by the maintainer only, by pushing a `vX.Y.Z` tag (which
triggers [`.github/workflows/release.yml`](.github/workflows/release.yml)).
**Please don't create or push version tags in a PR** — open the PR, and
the maintainer will handle versioning and the release once it's merged.

## Code of conduct

Be respectful and constructive. Report unacceptable behavior directly to
the maintainer.
