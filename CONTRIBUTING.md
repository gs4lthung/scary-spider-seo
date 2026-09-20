# Contributing to Scary Spider SEO

This project does not accept pull requests — it's maintained solely by
the owner. If you find a bug or have an idea for a feature, please
[open an issue](https://github.com/gs4lthung/gseo/issues) instead.
Unsolicited PRs will be closed without review.

## Reporting a bug

Please include:

- What you did, what you expected, and what happened instead
- Your OS and the build you're using (installer filename or app version)
- Steps to reproduce, and a URL to crawl if the issue is site-specific

## Building locally (to help reproduce or investigate an issue)

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

## The website

`website/` is the marketing site (separate Next.js project, its own
`package.json`, independent of the app) — maintained solely by the
project owner.

## Code of conduct

Be respectful and constructive when opening issues. Report unacceptable
behavior directly to the maintainer.
