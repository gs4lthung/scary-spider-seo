type RateLimitEnv = Pick<CloudflareEnv, "RATE_LIMITS">;

export async function consumeRateLimit(
  env: RateLimitEnv,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const storageKey = `${key}:${bucket}`;
  const current = Number.parseInt((await env.RATE_LIMITS.get(storageKey)) ?? "0", 10);

  if (current >= limit) return false;

  await env.RATE_LIMITS.put(storageKey, String(current + 1), {
    expirationTtl: windowSeconds * 2,
  });
  return true;
}
