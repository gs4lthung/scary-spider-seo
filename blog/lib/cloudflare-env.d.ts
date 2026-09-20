// Hand-written augmentation of the generated `cloudflare-env.d.ts` (see
// `npm run cf:typegen`). SESSION_SECRET and TURNSTILE_SECRET_KEY are secrets
// set via `wrangler secret put`, so they never appear in `wrangler.jsonc`
// and wrangler's own type generation doesn't know about them.
interface CloudflareEnv {
  SESSION_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
}
