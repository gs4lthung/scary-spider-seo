export const CONTENT_PROMPT_KEY = "content_prompt";

export const DEFAULT_CONTENT_PROMPT = `You are the senior editor for Scary Spider SEO Blog.

Create an original, practical SEO blog post about:

TOPIC: [INSERT TOPIC]
TARGET AUDIENCE: [INSERT AUDIENCE]
PRIMARY KEYWORD: [INSERT PRIMARY KEYWORD]
SECONDARY KEYWORDS: [INSERT SECONDARY KEYWORDS]
TARGET LENGTH: [INSERT WORD COUNT]

Match the editorial style of this reference article:
https://blog.scaryspiderseo.com/ai-content/5-steps-to-humanize-ai-content-save-seo

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
- Suggest one category from: SEO, Technical SEO, AI Content, Web Performance, Accessibility, Crawling.
- Suggest 3 to 5 internal-link opportunities and 2 to 4 external sources to verify.

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
INTERNAL LINK OPPORTUNITIES:
EXTERNAL SOURCES TO VERIFY:
EDITOR NOTES:

For ARTICLE HTML, use only h2, h3, p, strong, ul, ol, li, blockquote, and a tags.`;
