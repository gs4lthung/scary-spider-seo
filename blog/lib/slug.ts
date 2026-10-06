// Post slug rules, shared by the editor (app/admin/PostForm.tsx) and the save
// actions (app/admin/posts-actions.ts) so the server stores exactly what the
// form previews, whatever the client sends.

export const MAX_SLUG_LENGTH = 100;

// Top-level paths the app already owns. An uncategorized post is served at
// /<slug>, so one of these as a slug would be shadowed or break a route.
export const RESERVED_SLUGS = new Set(["admin", "api", "author", "media", "healthz", "feed-xml", "sitemap-xml", "robots-txt"]);

// Accented letters become plain ASCII ("Hướng dẫn" -> "huong-dan") instead of
// being dropped, matching lib/post-url.ts::slugifyCategory. "đ" has no
// Unicode decomposition, so it is mapped by hand.
function toAsciiLower(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

// Final form: lowercase a-z, 0-9 and single hyphens, no hyphen at either end,
// at most MAX_SLUG_LENGTH characters.
export function slugify(value: string): string {
  return toAsciiLower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

// For the slug input while the user types: same rules, but a trailing hyphen
// is kept so "my-" can become "my-post". slugify() runs on blur and on save.
export function slugifyWhileTyping(value: string): string {
  return toAsciiLower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG_LENGTH);
}
