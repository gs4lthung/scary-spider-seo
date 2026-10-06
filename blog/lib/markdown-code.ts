// Converts Markdown-style code left inside imported HTML into real code
// markup. Writing tools often mix the two, e.g. "<p>Use `Disallow: /` to
// block a folder.</p>", and the editor's Import HTML (setContent) does not run
// Tiptap's typing/paste rules, so the backticks would otherwise show as plain
// text. Browser-only (uses DOMParser); called from RichTextEditor importHtml.
//
// - `inline` inside text becomes <code>inline</code>.
// - A ``` fence (in one paragraph, or opened and closed across consecutive
//   paragraphs) becomes <pre><code>...</code></pre>.
// Text already inside <code>/<pre> is left as is.

const INLINE_CODE = /`([^`\n]+)`/g;

function textWithLineBreaks(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  return clone.textContent ?? "";
}

function convertFences(doc: Document) {
  const blocks = Array.from(doc.body.children);
  for (let i = 0; i < blocks.length; i++) {
    const start = blocks[i];
    if (start.tagName !== "P" || !(start.textContent ?? "").trim().startsWith("```")) continue;

    // Find the paragraph that closes the fence (may be the same one).
    let end = -1;
    for (let j = i; j < blocks.length; j++) {
      if (blocks[j].tagName !== "P") break;
      const text = (blocks[j].textContent ?? "").trim();
      const closes = j === i ? text.length > 3 && text.endsWith("```") : text.endsWith("```");
      if (closes) {
        end = j;
        break;
      }
    }
    if (end === -1) continue;

    const raw = blocks
      .slice(i, end + 1)
      .map(textWithLineBreaks)
      .join("\n")
      .trim();
    const code = raw
      .replace(/^```[\w-]*[ \t]*\n?/, "")
      .replace(/\n?```$/, "");

    const pre = doc.createElement("pre");
    const codeEl = doc.createElement("code");
    codeEl.textContent = code;
    pre.appendChild(codeEl);
    start.replaceWith(pre);
    for (let j = i + 1; j <= end; j++) blocks[j].remove();
    i = end;
  }
}

function convertInlineCode(doc: Document) {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!text.data.includes("`") || text.parentElement?.closest("code, pre")) continue;
    textNodes.push(text);
  }

  for (const text of textNodes) {
    INLINE_CODE.lastIndex = 0;
    if (!INLINE_CODE.test(text.data)) continue;
    INLINE_CODE.lastIndex = 0;

    const fragment = doc.createDocumentFragment();
    let last = 0;
    for (const match of text.data.matchAll(INLINE_CODE)) {
      const index = match.index ?? 0;
      if (index > last) fragment.append(text.data.slice(last, index));
      const code = doc.createElement("code");
      code.textContent = match[1];
      fragment.append(code);
      last = index + match[0].length;
    }
    if (last < text.data.length) fragment.append(text.data.slice(last));
    text.replaceWith(fragment);
  }
}

export function convertMarkdownCode(html: string): string {
  if (!html.includes("`")) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  convertFences(doc);
  convertInlineCode(doc);
  return doc.body.innerHTML;
}
