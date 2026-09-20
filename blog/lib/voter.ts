import { cookies } from "next/headers";

// Anonymous per-browser id used to dedupe comment votes before accounts
// exist. Read-only outside a Server Action/Route Handler (cookies() can't
// be mutated during a normal page render), so pages that only need to know
// "did this visitor already vote" call getVoterKey(); voteComment (a Server
// Action) calls getOrCreateVoterKey() to mint one on first use.
const VOTER_COOKIE = "voter_id";
const VOTER_TTL_SECONDS = 60 * 60 * 24 * 365;

export async function getVoterKey(): Promise<string | null> {
  const store = await cookies();
  return store.get(VOTER_COOKIE)?.value ?? null;
}

export async function getOrCreateVoterKey(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VOTER_COOKIE)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  store.set(VOTER_COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: VOTER_TTL_SECONDS,
  });
  return id;
}
