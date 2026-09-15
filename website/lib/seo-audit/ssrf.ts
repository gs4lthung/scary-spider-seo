import dns from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (169.254.169.254)
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice("::ffff:".length);
    return net.isIPv4(mapped) ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true;
}

/**
 * Resolves `hostname` and returns only public IPs. Used both to validate a
 * URL up front and, per redirect hop and again immediately before the
 * socket connects, to pick the exact address dialed — so a DNS record that
 * changes between our check and the actual connection (rebinding) can't
 * hand the request a private address.
 */
export async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: number }> {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new UnsafeUrlError("That host isn't allowed for this demo.");
    return { address: hostname, family: net.isIPv6(hostname) ? 6 : 4 };
  }

  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local")) {
    throw new UnsafeUrlError("That host isn't allowed for this demo.");
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  const publicRecord = records.find((r) => !isPrivateIp(r.address));
  if (!publicRecord) {
    throw new UnsafeUrlError("That host isn't allowed for this demo.");
  }
  return publicRecord;
}

export function assertPublicHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Enter a full URL, e.g. https://example.com");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http:// and https:// URLs are supported.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with credentials aren't supported.");
  }
  return url;
}
