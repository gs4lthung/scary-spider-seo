// Hand-written augmentation of the generated `cloudflare-env.d.ts` (see
// `npm run cf:typegen`). SESSION_SECRET is a secret set via
// `wrangler secret put SESSION_SECRET`, so it never appears in
// `wrangler.jsonc` and wrangler's own type generation doesn't know about it.
interface CloudflareEnv {
  SESSION_SECRET: string;
}
