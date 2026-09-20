// Prints a password_hash value for the `users` table, in the
// `<base64 salt>:<base64 hash>` format lib/auth.ts expects.
// Usage: npm run admin:hash-password -- "your-password"
import { webcrypto as crypto } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run admin:hash-password -- "your-password"');
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
  "deriveBits",
]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);

const b64 = (buf) => Buffer.from(buf).toString("base64");
console.log(`${b64(salt)}:${b64(bits)}`);
