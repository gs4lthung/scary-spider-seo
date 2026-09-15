import http from "node:http";
import https from "node:https";
import { assertPublicHttpUrl, resolvePublicAddress, UnsafeUrlError } from "./ssrf";

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 3 * 1024 * 1024; // 3MB is plenty of HTML for a single-page audit
const REQUEST_TIMEOUT_MS = 8_000;
const USER_AGENT = "ScarySpiderSEO-Demo/1.0 (+https://www.scaryspiderseo.com/demo)";

export { UnsafeUrlError };

export interface FetchedPage {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  timeMs: number;
  redirectCount: number;
}

function fetchOnce(url: URL, address: string): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  truncated: boolean;
}> {
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        method: "GET",
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        // Force the connection to the address we already vetted as public,
        // instead of letting the transport re-resolve the hostname (which
        // would reopen the DNS-rebinding window resolvePublicAddress closes).
        lookup: (_hostname, options, callback) => {
          const family = address.includes(":") ? 6 : 4;
          // Node's Happy Eyeballs connect path (default since Node 20) calls
          // this with `{ all: true }` and expects an array back; a plain
          // single-address callback there produces this exact
          // ERR_INVALID_IP_ADDRESS crash.
          if (typeof options === "object" && options?.all) {
            callback(null, [{ address, family }]);
            return;
          }
          callback(null, address, family);
        },
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        timeout: REQUEST_TIMEOUT_MS,
        // Send the original hostname in the TLS handshake / Host header,
        // not the raw IP we're dialing.
        servername: url.protocol === "https:" ? url.hostname : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;

        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            truncated = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
            truncated,
          });
        });
        res.on("error", reject);
      },
    );

    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchPageSafely(rawUrl: string): Promise<FetchedPage> {
  const startedAt = Date.now();
  let current = assertPublicHttpUrl(rawUrl);
  let redirectCount = 0;

  while (true) {
    const { address } = await resolvePublicAddress(current.hostname);
    const { status, headers, body } = await fetchOnce(current, address);

    const isRedirect = status >= 300 && status < 400 && headers.location;
    if (isRedirect && redirectCount < MAX_REDIRECTS) {
      redirectCount += 1;
      current = assertPublicHttpUrl(new URL(headers.location as string, current).toString());
      continue;
    }

    return {
      requestedUrl: rawUrl,
      finalUrl: current.toString(),
      status,
      headers: Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : (value ?? "")]),
      ),
      html: body,
      timeMs: Date.now() - startedAt,
      redirectCount,
    };
  }
}
