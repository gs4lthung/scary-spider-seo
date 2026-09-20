# Security Hardening

## Implemented in Code

- Security headers and CSP report-only mode are configured for the website and blog.
- Turnstile tokens must match the expected action and hostname.
- Track-view requests are limited to 30 per minute per IP hash using dedicated KV storage.
- Comment votes are limited to 60 per minute per IP hash or voter key.
- Media uploads validate both the declared type and file signature.
- Media deletion requires the `posts:write` permission and a generated media key format.
- Dependabot checks npm, Cargo, and GitHub Actions dependencies weekly.
- Gitleaks scans pull requests, main pushes, and weekly repository history.

## Cloudflare Dashboard Tasks

These tasks cannot be represented by the application repository alone:

- Cloudflare Zero Trust Access for `blog.scaryspiderseo.com/admin/*`.
- Cloudflare Free Managed Ruleset.
- The custom malicious-path blocking rule.
- GitHub secret scanning and push protection settings.

The DNS zone is currently on the Free plan. Native Cloudflare Rate Limiting Rules are deferred. Application-level KV limits are the current protection for view tracking and comment voting.

## CSP Rollout

CSP is currently sent as `Content-Security-Policy-Report-Only` so violations can be reviewed without breaking Next.js, Turnstile, media, or the admin editor. After checking production responses and browser console reports, convert it to `Content-Security-Policy` and tighten `unsafe-inline` where the framework allows.

## Secret Hygiene

Local `.dev.vars` files are ignored and must never be committed. Verify GitHub secret scanning has no historical findings. Rotate `SESSION_SECRET`, `TURNSTILE_SECRET_KEY`, and Cloudflare tokens if they were ever shared outside protected secret storage.
