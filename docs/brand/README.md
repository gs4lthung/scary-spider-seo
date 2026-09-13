# Brand assets

`logo-source.png` is the current app icon master (purple spider mascot,
transparent background) — a copy of `purple_spider_icon.png`. To swap it
for a different logo later, drop the new file in as `logo-source.png`
(square, transparent background, 1024px+) and re-run the command below.

`docs/banner.png` (the README banner) is a copy of
`scary_banner_purple_gradient.png`.

To regenerate every app icon size/format from `logo-source.png` in one shot:

```bash
npm run tauri icon docs/brand/logo-source.png
```

This overwrites everything in `src-tauri/icons/` (favicon, Windows `.ico`,
macOS `.icns`, Store/Square logos, etc.) — no manual resizing needed.
