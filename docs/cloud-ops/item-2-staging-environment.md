# Item 2: Staging Environment

## Objective

Create a separate Cloudflare environment for the blog, completely isolated from production, so changes can be tested before deploying to users.

## Status: Done

## What's Implemented

### Staging Resources

| Resource | Production | Staging |
|----------|-----------|---------|
| Worker | `scary-spider-seo-blog` | `scary-spider-seo-blog-staging` |
| D1 Database | `blog-db` | `blog-db-staging` |
| R2 Bucket | `blog-media` | `blog-media-staging` |
| KV (ISR cache) | `67b80fb5c4634f4fb6323bcdb17bbfd4` | `d57b4db4e2e744b5b97078bac5e2b4a4` |
| KV (Rate limits) | `66c2ed03b5724ac98f44190116204951` | `e7077526ff91482ab31ef1a3fd785b46` |
| Queue | `comment-notifications` | `comment-notifications-staging` |
| Queue DLQ | `comment-notifications-dlq` | `comment-notifications-dlq-staging` |
| Consumer Worker | `scary-spider-seo-comment-notifications` | `scary-spider-seo-comment-notifications-staging` |
| KV (Notif state) | `3e3d1c081e6a4198b69dc53f126a7057` | `e17081bafd81497888a2a1ae13042b33` |
| Turnstile | Production widget | Staging widget (`0x4AAAAAAE9zc2Pmiy09kWBM`) |
| URL | `blog.scaryspiderseo.com` | `scary-spider-seo-blog-staging.lthung-work-79.workers.dev` |

### Configuration

All staging bindings are defined in `blog/wrangler.jsonc` under `env.staging`. Each staging resource uses a `-staging` suffix or separate ID.

### Secrets

Set separately on the staging Worker:

```bash
npx wrangler secret put SESSION_SECRET --env staging --config blog/wrangler.jsonc
npx wrangler secret put TURNSTILE_SECRET_KEY --env staging --config blog/wrangler.jsonc
npx wrangler secret put ALERT_TO_EMAIL --config ops/comment-notifications/wrangler.jsonc --env staging
```

## How It Works

1. Push to the `staging` branch triggers `deploy-staging.yml`
2. D1 migrations run against `blog-db-staging`
3. Blog Worker deploys with staging bindings
4. Comment notification consumer deploys with staging queue

## How to Verify

```bash
# Deploy to staging
npm run cf:deploy:staging

# Check staging health
curl https://scary-spider-seo-blog-staging.lthung-work-79.workers.dev/healthz
```

## Gaps / TODO

- No staging website deploy (marketing site has no staging)
- Site monitor only checks production URLs, not staging
- No Cloudflare Access on staging admin (intentional: staging is less restricted)
