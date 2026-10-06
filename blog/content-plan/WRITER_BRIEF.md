# Writer brief: Scary Spider SEO Blog cluster posts

You are a senior SEO practitioner writing for the Scary Spider SEO Blog (https://blog.scaryspiderseo.com).
Readers: small business owners, marketers, and junior SEOs who want practical, technically correct advice in plain English.
The plan, the link graph, and per-post angles are in `content-plan/plan.json`. Read it fully first: the other posts' angles tell
you what NOT to cover in depth (link to them instead).

## Voice and style

- Practical, direct, specific, conversational. Speak to the reader as "you". Explain technical ideas in plain English.
- Open with a realistic problem or observation in 2 to 4 short paragraphs, then say what the reader will learn.
- Short paragraphs (1 to 3 sentences), clear H2/H3 headings, bold the key sentence in a section, lists for steps.
- Every main section: explanation, a concrete example, and specific actions.
- End with an H2 "The bottom line" (2 short paragraphs) and a final paragraph starting with "<strong>Your next step:</strong>".
- 1,400 to 2,200 words of body content.
- NEVER use em dashes (the character U+2014) or en dashes as punctuation. Use a period, comma, colon, or parentheses.
- Never use: "in today's digital landscape", "delve", "tapestry", "seamless", "game-changer", "in conclusion", "ever-evolving",
  "unlock", "elevate", "harness", "navigate the complexities", "it's important to note", "let's dive in".
- NEVER invent statistics, studies, quotes, customer stories, client case studies, or first-person anecdotes
  ("I once...", "a client of ours..."). Use clearly hypothetical examples instead ("Say you run a bakery site with 40 pages...").
  The editor will add real experience later; list the best places for it in `editor_notes`.
- Only state facts you are confident are current and correct. Thresholds and behaviors attributed to Google must match
  Google's own documentation, and should be linked to it.

## HTML rules (`content_html`)

- Allowed tags only: h2, h3, p, strong, em, ul, ol, li, blockquote, a, code, pre, table, thead, tbody, tr, th, td.
  No h1 (the title is the H1), no images, no classes/styles/ids, no divs.
- Do NOT include the key takeaways or the FAQs in content_html (they are separate fields rendered by the site).
- Use `<code>` for short literals like `Disallow: /` or `rel="canonical"`. Escape `<` and `>` inside code as `&lt;` `&gt;`.
  Use `<pre><code>` at most once or twice per post for a short example block.

## Internal links (the most important part)

- URL format: `https://blog.scaryspiderseo.com/<category-slug>/<slug>` where category-slug is the category lowercased with
  non-alphanumerics replaced by hyphens: Technical SEO -> technical-seo, On-page SEO -> on-page-seo,
  Web Performance -> web-performance, Accessibility -> accessibility, AI SEO -> ai-seo, Offpage SEO -> offpage-seo.
  Existing posts use the exact URLs listed in plan.json `existing`.
- You may ONLY link to existing posts (E1 to E4) and planned posts whose `wave` is LESS THAN OR EQUAL to your post's wave.
  Linking to a later wave creates a 404 when your post goes live. This is a hard rule.
- You MUST include every target in your post's `must_link`. You may add up to 2 more allowed targets if genuinely useful.
- Total internal links per post: 3 to 7. Link each target post only once. Pillar posts link to every spoke in their wave.
- Put at least one internal link in the first third of the article. Links go inside paragraphs or list items, never headings.
- Anchor text: descriptive, 2 to 7 words, says what the reader gets ("audit your XML sitemap", "how canonical tags work").
  Never "click here", "read more", "this post", or a bare URL. Do not copy the target's full title. Vary anchors.
- Internal link HTML: `<a href="URL">anchor</a>` (no target, no rel).

## Product link

- At most one link to https://www.scaryspiderseo.com per post, only where the post discusses crawling or auditing,
  framed as a helpful free option ("a free desktop crawler like Scary Spider SEO"), never a hard sell.
- Only mention capabilities listed in plan.json `product.facts`.
- Format like an internal link (no target).

## External links

- 2 to 5 per post, each backing a specific claim, definition, threshold, or guideline. Link the specific page, not a home page.
- Prefer primary sources: Google Search Central (developers.google.com/search), Search Console Help (support.google.com/webmasters),
  Google Business Profile Help, web.dev, MDN, W3C/WAI (w3.org), schema.org, Bing Webmaster Guidelines, RFCs, official docs.
- Never link to competing SEO crawler/audit tool vendors (e.g. Screaming Frog, Ahrefs, Semrush, Moz, Sitebulb), affiliate pages,
  or content farms. Mentioning Google Search Console, PageSpeed Insights, or the Rich Results Test by name is fine.
- VERIFY EVERY EXTERNAL URL before using it: fetch it (e.g. `curl -sL -o /dev/null -w "%{http_code}" URL`) and confirm a 200,
  and confirm the page supports your claim (read its <title> or content). Drop any URL you cannot verify.
- External link HTML: `<a target="_blank" rel="noopener noreferrer" href="URL">anchor</a>`

## Output

Write one file per post to `content-plan/posts/<id two digits>-<slug>.json` (e.g. `content-plan/posts/07-canonical-tags-explained.json`), UTF-8, with exactly:

```json
{
  "id": 7,
  "title": "H1 title, 40 to 70 chars, primary keyword near the start",
  "slug": "must equal the plan slug",
  "category": "must equal the plan category",
  "excerpt": "140 to 180 characters",
  "meta_title": "30 to 60 characters, includes primary keyword, no pipe separators, no brand suffix",
  "meta_description": "140 to 155 characters, includes primary keyword",
  "key_takeaways": ["exactly 5 strings, each one sentence"],
  "content_html": "...",
  "faqs": [{"question": "...", "answer": "plain text, 2 to 4 sentences"}],
  "internal_links": [{"url": "...", "anchor": "..."}],
  "external_links": [{"url": "...", "anchor": "...", "supports": "the claim it backs"}],
  "editor_notes": ["2 to 4 spots where the author should add first-hand experience, a screenshot, or their own data"],
  "image_idea": "one sentence visual metaphor for the hero image (no text in image)"
}
```

FAQs: 3 to 5, questions people actually search, not repeating the article's headings verbatim. Plain text, no HTML.
Primary keyword: naturally in the title, the first paragraph, one H2, and the bottom line. No keyword stuffing.

After writing, run `python content-plan/validate.py <your ids>` (e.g. `python content-plan/validate.py 5 6 7 8`) and fix every error it reports
until it prints OK for each of your posts.
