export type Role = "admin" | "editor";

export type SessionPayload = {
  userId: number;
  username: string;
  role: Role;
  exp: number;
};

const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Buffer.from(buf).toString("base64url");
}

function fromBase64Url(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64url"));
}

// No node:crypto in this file — it's imported by middleware, which
// bundles under Next's edge runtime and can't resolve `node:` imports.
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return `${Buffer.from(salt).toString("base64")}:${Buffer.from(bits).toString("base64")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltB64, hashB64] = storedHash.split(":");
  if (!saltB64 || !hashB64) return false;

  const salt = new Uint8Array(Buffer.from(saltB64, "base64"));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );

  const expected = new Uint8Array(Buffer.from(hashB64, "base64"));
  const actual = new Uint8Array(bits);
  return constantTimeEqual(expected, actual);
}

export async function createSessionCookieValue(
  secret: string,
  user: { userId: number; username: string; role: Role },
): Promise<string> {
  const payload: SessionPayload = { ...user, exp: Date.now() + SESSION_TTL_SECONDS * 1000 };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${toBase64Url(sig)}`;
}

export async function verifySessionCookieValue(
  secret: string,
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(sigB64),
    new TextEncoder().encode(payloadB64),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64))) as SessionPayload;
    if (typeof payload.exp !== "number" || Date.now() >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE, SESSION_TTL_SECONDS };
