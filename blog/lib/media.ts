// Media keys referenced by a post are just "/media/<key>" substrings inside
// the post's stored HTML (body images) plus the separate coverImageKey
// field. Pulling them out lets us diff old vs new content on save/delete so
// R2 doesn't silently accumulate images nobody references anymore.
const MEDIA_SRC_PATTERN = /\/media\/([A-Za-z0-9-]+\.[A-Za-z0-9]+)/g;
const BARE_KEY_PATTERN = /^[A-Za-z0-9-]+\.[A-Za-z0-9]+$/;

// The cover image field stores whatever was uploaded ("/media/<key>") but
// also accepts a hand-pasted external URL, which isn't an R2 object at all
// and must never be sent to R2's delete API.
function normalizeMediaKey(value: string): string | null {
  const match = value.match(MEDIA_SRC_PATTERN);
  if (match) return match[0].replace("/media/", "");
  return BARE_KEY_PATTERN.test(value) ? value : null;
}

export function extractMediaKeys(content: string, coverImageKey?: string | null): string[] {
  const keys = new Set<string>();
  for (const match of content.matchAll(MEDIA_SRC_PATTERN)) keys.add(match[1]);
  if (coverImageKey) {
    const key = normalizeMediaKey(coverImageKey);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function diffRemovedMediaKeys(
  before: { content: string; coverImageKey: string | null },
  after: { content: string; coverImageKey: string | null },
): string[] {
  const beforeKeys = extractMediaKeys(before.content, before.coverImageKey);
  const afterKeys = new Set(extractMediaKeys(after.content, after.coverImageKey));
  return beforeKeys.filter((key) => !afterKeys.has(key));
}
