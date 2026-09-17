import { SITE_URL } from "@/lib/site";

type PostLike = { slug: string; category?: string | null };

// Category slugs are derived from the post's freeform category name (posts
// store the name, not a FK). Diacritics are stripped so the path is clean
// ASCII, matching the heading anchor slugs in lib/toc.ts.
export function slugifyCategory(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Canonical public path for a post: /<category-slug>/<slug> when the post has
// a usable category, otherwise just /<slug> (uncategorized posts stay flat).
export function postPath(post: PostLike): string {
  const category = post.category?.trim();
  if (category) {
    const categorySlug = slugifyCategory(category);
    if (categorySlug) return `/${categorySlug}/${post.slug}`;
  }
  return `/${post.slug}`;
}

export function postUrl(post: PostLike): string {
  return `${SITE_URL}${postPath(post)}`;
}