import { headers } from "next/headers";

// A one-way, HMAC'd stand-in for the submitter's IP so we can rate-limit
// anonymous comments without persisting a raw, reversible IP address
// anywhere. Reuses SESSION_SECRET (already a real secret in this app) as
// the HMAC key instead of introducing a new one.
async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(sig).toString("hex");
}

export async function getRequestIpHash(secret: string): Promise<string | null> {
  const store = await headers();
  // Cloudflare sets cf-connecting-ip at the edge (can't be spoofed by the
  // client); x-forwarded-for is a fallback for local `next dev`.
  const ip = store.get("cf-connecting-ip") ?? store.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return null;
  return hmacHex(secret, ip);
}
