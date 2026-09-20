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

function decodeEscapedMarkup(html: string): string {
  if (!/&lt;\/?(?:h[2-6]|p|br|hr|ul|ol|li|blockquote|pre|code|a|img|strong|em|u|s|span|table|thead|tbody|tr|th|td)(?:\s|\/?>)/i.test(html)) {
    return html;
  }

  return html
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, "&");
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
