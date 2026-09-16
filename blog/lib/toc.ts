export type TocItem = { id: string; text: string; level: 2 | 3 };

const HEADING_PATTERN = /<h([23])((?: [^>]*)?)>([\s\S]*?)<\/h[23]>/g;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (Vietnamese, etc.) for a clean ASCII anchor
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "section";
}

// Gives every H2/H3 in a post's HTML a stable #id (derived from its text) so
// a table of contents can link to it, and returns the flat heading list for
// rendering that TOC. Body headings start at H2 since the page's <h1> is
// always the post title (see RichTextEditor's configured heading levels).
export function parseHeadings(html: string): { html: string; items: TocItem[] } {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();

  const withIds = html.replace(HEADING_PATTERN, (match, levelStr, attrs, inner) => {
    const level = Number(levelStr) as 2 | 3;
    const text = decodeEntities(stripTags(inner)).trim();
    if (!text) return match;

    let slug = slugify(text);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;

    items.push({ id: slug, text, level });

    if (/\sid=/.test(attrs)) return match;
    return `<h${level}${attrs} id="${slug}">${inner}</h${level}>`;
  });

  return { html: withIds, items };
}
