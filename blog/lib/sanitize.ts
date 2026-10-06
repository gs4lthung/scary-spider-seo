import sanitizeHtml from "sanitize-html";

// Server-side sanitization for post HTML. Post bodies are authored in the
// Tiptap editor, which sanitizes on the client, but the server actions accept
// raw HTML from a crafted request; the stored result is later rendered to
// every reader via dangerouslySetInnerHTML (PostArticle.tsx). This allowlist
// matches the editor's output (headings h2+, prose, links, images, font-size
// spans, tables) and drops everything else.
const POST_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "ul", "ol", "li",
    "blockquote",
    "pre", "code",
    "a", "img",
    "strong", "em", "u", "s",
    "span",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
    span: ["style"],
    th: ["colspan", "rowspan", "style", "align"],
    td: ["colspan", "rowspan", "style", "align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedStyles: {
    span: { "font-size": [/^\d+(?:px|rem|em|%)$/] },
  },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: attribs.target === "_blank" ? "noopener noreferrer" : attribs.rel ?? "",
      },
    }),
  },
};

const ESCAPED_TAG = /&lt;\/?(?:h[2-6]|p|br|hr|ul|ol|li|blockquote|pre|code|a|img|strong|em|u|s|span|table|thead|tbody|tr|th|td)(?:\s|\/?>|\/?&gt;)/i;
// <pre>/<code> elements, matched whole so their contents are left alone.
const CODE_SEGMENT = /(<pre\b[\s\S]*?<\/pre>|<code\b[\s\S]*?<\/code>)/gi;

function unescapeMarkup(text: string): string {
  return text
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, "&");
}

// Repairs article HTML that was pasted into the editor as text (so it got
// escaped, e.g. "<p>&lt;h2&gt;Title&lt;/h2&gt;</p>") by turning the escaped
// tags back into markup. Code is never touched: "<code>&lt;a href&gt;</code>"
// is a deliberately escaped example and must stay text, or the sanitizer would
// turn it into a real link (or drop it). Only the parts outside <pre>/<code>
// are checked and decoded.
function decodeEscapedMarkup(html: string): string {
  const parts = html.split(CODE_SEGMENT);
  // split() with a capture group puts the code segments at odd indexes.
  const outsideCode = parts.filter((_, i) => i % 2 === 0);
  if (!outsideCode.some((part) => ESCAPED_TAG.test(part))) return html;
  return parts.map((part, i) => (i % 2 === 0 ? unescapeMarkup(part) : part)).join("");
}

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(decodeEscapedMarkup(html), POST_HTML_OPTIONS);
}

// Strips all markup, keeping only text. Used for fields that are stored as
// plain text and later emitted inside JSON-LD <script> blocks (FAQs), where
// stray markup or "</script>" could otherwise escape the script context.
export function stripTags(value: string): string {
  return sanitizeHtml(value, { allowedTags: [] }).trim();
}
