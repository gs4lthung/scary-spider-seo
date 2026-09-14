# Scary Spider SEO — website

The marketing/branding site for Scary Spider SEO. This is a standalone
Next.js project, independent of the desktop app in `src/`/`src-tauri/` —
its own `package.json`, its own deploy target (e.g. Vercel), no shared
build step with the app.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4, mirroring the
app's own stack and reusing its comic-panel purple theme tokens
(`app/globals.css` is a trimmed copy of the app's `src/index.css` theme).

## Develop

```bash
cd website
npm install
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Assets

`public/` holds copies of the brand assets from `../docs/brand/` and
`../src-tauri/icons/`. If the mascot/logo changes, re-export from there
rather than editing these copies directly.
