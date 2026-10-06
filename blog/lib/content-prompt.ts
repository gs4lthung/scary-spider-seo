import { DEFAULT_CATEGORY, postUrl } from "@/lib/post-url";
import { MAIN_SITE_URL } from "@/lib/site";

export const CONTENT_PROMPT_KEY = "content_prompt";
export const IMAGE_PROMPT_KEY = "image_prompt";

// Replaced with the live list of published posts when the prompt is copied
// from /admin/prompts, so the model can only link to posts that really exist.
export const INTERNAL_LINKS_TOKEN = "[INTERNAL LINK LIBRARY]";

type LinkablePost = { title: string; slug: string; category: string | null; excerpt: string | null };

export function buildInternalLinkLibrary(posts: LinkablePost[]): string {
  if (posts.length === 0) return "(No published posts yet. Skip internal links.)";
  return posts
    .map((post) => {
      const lines = [`- ${post.title} (${post.category?.trim() || DEFAULT_CATEGORY})`, `  URL: ${postUrl(post)}`];
      if (post.excerpt?.trim()) lines.push(`  About: ${post.excerpt.trim()}`);
      return lines.join("\n");
    })
    .join("\n");
}

// Fills the library into a prompt. A saved prompt from before the token
// existed still gets the library, appended at the end.
export function withInternalLinkLibrary(prompt: string, library: string): string {
  if (prompt.includes(INTERNAL_LINKS_TOKEN)) return prompt.replaceAll(INTERNAL_LINKS_TOKEN, library);
  return `${prompt}\n\nINTERNAL LINK LIBRARY (published posts; link only to these, using the URLs exactly)\n${library}`;
}

export const DEFAULT_CONTENT_PROMPT = `You are the senior editor for Scary Spider SEO Blog.

Create an original, practical SEO blog post about:

TOPIC: [INSERT TOPIC]
TARGET AUDIENCE: [INSERT AUDIENCE]
PRIMARY KEYWORD: [INSERT PRIMARY KEYWORD]
SECONDARY KEYWORDS: [INSERT SECONDARY KEYWORDS]
TARGET LENGTH: [INSERT WORD COUNT]

Match the editorial style of this reference article:
https://blog.scaryspiderseo.com/ai-seo/5-steps-to-humanize-ai-content-save-seo

Follow its editorial approach, structure, and level of detail, but never copy its wording, title, examples, or ideas.

STYLE
- Write like an experienced SEO practitioner speaking directly to the reader.
- Open with a realistic problem, observation, or short story.
- Be practical, direct, specific, and conversational.
- Explain technical ideas in plain English.
- Use short paragraphs, clear H2 and H3 headings, practical examples, and bold emphasis.
- Include first-hand experience or clearly marked places where the editor should add it.
- Avoid generic introductions, filler, and exaggerated marketing claims.
- Do not use em dashes.
- Do not use phrases such as "in today's digital landscape," "delve into," "tapestry," "seamless," "game-changer," or "in conclusion."
- Never invent statistics, studies, quotes, customer stories, or product claims. Mark anything requiring verification.

STRUCTURE
1. Write an SEO-focused title.
2. Write an excerpt between 140 and 180 characters.
3. Write an introduction that explains the problem, why it matters, and what the reader will learn.
4. Add exactly 5 concise key takeaways.
5. Organize the article into 4 to 6 useful H2 sections.
6. Give every main section an explanation, an example, and specific actions.
7. Add a short "The bottom line" section.
8. Add 3 to 5 useful FAQs with answers.
9. End with a practical next step.

SEO
- Use the primary keyword naturally in the title, introduction, one H2, and conclusion.
- Do not keyword-stuff.
- Create a meta title under 60 characters.
- Create a meta description between 140 and 155 characters.
- Suggest a lowercase URL slug with hyphens.
- Suggest one category. Reuse the exact category of the closest related post in the INTERNAL LINK LIBRARY when one fits; otherwise propose a new short category name.

INTERNAL LINKS (to other Scary Spider SEO Blog posts)
- Add 2 to 4 internal links inside ARTICLE HTML, chosen only from the INTERNAL LINK LIBRARY below. Never invent a blog URL or link to a post that is not listed.
- Link only where the target post genuinely helps the reader at that point. Put at least one link in the first third of the article.
- Place links inside paragraphs or list items, never inside headings, the key takeaways, or the FAQs.
- Use descriptive anchor text of 2 to 6 words that tells the reader what they will get, for example "humanize AI drafts before publishing". Never use "click here", "read more", "this article", or a bare URL as anchor text.
- Vary the anchor text, do not copy the target post's full title, and link to each post only once.
- Use the full URL exactly as listed, with no target attribute: <a href="URL">anchor text</a>
- If no listed post is relevant, use fewer links rather than forcing one.

PRODUCT LINK
- Where the article talks about crawling a site, running an audit, or finding on-page issues, add at most one natural link to the Scary Spider SEO desktop crawler at ${MAIN_SITE_URL}. Mention it as a helpful option, never as a hard sell. Skip it if it does not fit.

EXTERNAL LINKS (to authoritative sources)
- Add 2 to 4 external links that back up a specific claim, definition, guideline, or statistic.
- Prefer primary, official sources: Google Search Central (developers.google.com/search), web.dev, MDN Web Docs, W3C and WAI, schema.org, Bing Webmaster Guidelines, or the official documentation of the tool being discussed.
- Link to the specific page that supports the claim, not a home page.
- Never link to competing SEO crawler or audit tool sales pages, affiliate pages, link sellers, or low-quality content farms.
- Only use a URL you are confident exists. If you are not sure of the exact URL, write [EXTERNAL LINK: describe the source needed] in the article instead of guessing, and list it under EXTERNAL LINKS TO VERIFY.
- Open external links in a new tab: <a href="URL" target="_blank">anchor text</a>

INTERNAL LINK LIBRARY (published posts; link only to these, using the URLs exactly)
${INTERNAL_LINKS_TOKEN}

OUTPUT
Return exactly these sections:
TITLE:
SLUG:
CATEGORY:
EXCERPT:
META TITLE:
META DESCRIPTION:
KEY TAKEAWAYS:
ARTICLE HTML:
FAQS:
INTERNAL LINKS USED:
EXTERNAL LINKS TO VERIFY:
LINK BACK OPPORTUNITIES:
EDITOR NOTES:

For ARTICLE HTML, use only h2, h3, p, strong, ul, ol, li, blockquote, and a tags.
For INTERNAL LINKS USED, list each link as: anchor text, URL, and the section it appears in.
For EXTERNAL LINKS TO VERIFY, list each external URL (or [EXTERNAL LINK] placeholder) with the exact claim it supports.
For LINK BACK OPPORTUNITIES, name 1 to 3 posts from the INTERNAL LINK LIBRARY that should link to this new article, with a suggested anchor text and the sentence or section where the link fits.`;

export const DEFAULT_IMAGE_PROMPT = `Create a distinctive editorial hero image for a Scary Spider SEO Blog article.

ARTICLE TOPIC: [INSERT TOPIC]
VISUAL IDEA: [INSERT THE CENTRAL VISUAL METAPHOR]
ASPECT RATIO: [INSERT ASPECT RATIO, FOR EXAMPLE 16:9]

Create one clear, memorable composition that communicates the article's idea at a glance. Use a sophisticated comic-book editorial style with bold ink outlines, expressive shapes, subtle halftone texture, and a dark charcoal, warm cream, and electric violet palette. The image should feel intelligent, slightly playful, and premium rather than childish or frightening.

COMPOSITION
- Make the subject large and easy to recognize at thumbnail size.
- Use strong foreground, middle-ground, and background separation.
- Leave calm negative space where a headline could be placed, but do not add any text.
- Use lighting and perspective to create depth without visual clutter.
- Make the visual metaphor specific to the article topic, not a generic laptop, graph, or magnifying glass.

AVOID
- No words, letters, captions, labels, logos, watermarks, UI screenshots, or fake readable text.
- No stock-photo look, generic corporate imagery, photorealistic people, or excessive gradients.
- No gore, horror, spiders covering the whole frame, or distracting decorative elements.

Return only the final image. Do not explain the prompt or include alternate concepts.`;
