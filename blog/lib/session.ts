import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SESSION_COOKIE, verifySessionCookieValue, type SessionPayload } from "./auth";

export async function getSession(): Promise<SessionPayload | null> {
  const { env } = await getCloudflareContext({ async: true });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionCookieValue(env.SESSION_SECRET, token);
}
