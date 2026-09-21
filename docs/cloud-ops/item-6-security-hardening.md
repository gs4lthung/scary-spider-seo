# Item 6: Security Hardening

## Objective

Improve the public attack surface with security headers, dependency scanning, secret scanning, rate limiting, and bot protection.

## Status: Done

## What's Implemented

### Security Headers

Both `blog/next.config.ts` and `website/next.config.ts` set these headers on all routes:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `Content-Security-Policy-Report-Only` | Full CSP with `default-src 'self'`, frame-ancestors/form-action restrictions, Turnstile carve-outs |

CSP is in **report-only** mode. Promote to enforcing after reviewing production violation reports.

### Dependency Scanning

**Dependabot** (`.github/dependabot.yml`):
- Weekly checks for npm (root, website, blog), cargo (src-tauri), and GitHub Actions
- Groups updates by ecosystem to reduce PR noise

**CodeQL** (`.github/workflows/codeql.yml`):
- Analyzes `javascript-typescript`, `rust`, and `actions` languages
- Runs on PRs, pushes to main, and weekly

### Secret Scanning

**Gitleaks** (`.github/workflows/secret-scan.yml`):
- Scans every PR and push to main
- Weekly full repository scan (Monday 02:17 UTC)
- Uses `fetch-depth: 0` for full history

### Rate Limiting

| Protection | Implementation | Limit |
|------------|---------------|-------|
| Login brute-force | `blog/lib/login-rate-limit.ts` (D1-backed) | 5 attempts per IP hash per 15 min |
| Comment submission | `blog/app/comments-actions.ts` (D1-backed) | 3 per IP per 10 min |
| Comment votes | `blog/app/comments-actions.ts` (KV-backed) | 60 per IP per hour |
| View tracking | `blog/app/api/track-view/route.ts` (KV-backed) | 30 per IP per hour |

Rate limit implementation: `blog/lib/rate-limit.ts` uses KV with sliding window buckets.

### Bot Protection (Turnstile)

- Cloudflare Turnstile verification on comment submission
- Honeypot field in comment form
- Time trap (minimum 2-second fill time)
- Hostname validation (Turnstile token must match expected hostname)
- Configurable comment approval moderation

### Media Security

- Upload type validation (MIME type + file signature check)
- Upload size limit (8 MB)
- Media deletion requires `posts:write` permission
- Only UUID-format media keys are accepted

## How It Works

```
Request arrives
  -> Security headers added by Next.js middleware/config
  -> CSP headers sent in report-only mode
  -> Rate limit checked (KV or D1)
  -> Turnstile token verified (comments)
  -> Input sanitized (post bodies)
  -> Permission checked (admin actions)
```

## How to Verify

```bash
# Check security headers
curl -I https://blog.scaryspiderseo.com/ | grep -i "strict-transport\|x-content-type\|x-frame\|content-security"

# Check CSP (should be report-only)
curl -I https://blog.scaryspiderseo.com/ | grep -i "content-security-policy"
```

## Gaps / TODO

- CSP is report-only (should promote to enforcing after review)
- Cloudflare Access for `/admin/*` is configured in the dashboard (not in code)
- Cloudflare Free Managed Ruleset is a dashboard-only toggle
- Native Cloudflare Rate Limiting Rules are deferred (KV limits are the current protection)
- No Web Application Firewall rules in code (managed via dashboard)
