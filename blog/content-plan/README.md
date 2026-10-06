# Content plan: topic clusters (24 posts, 5 waves)

Internal tooling for the blog's cluster rollout. Not part of the Next.js app.

| File | What it is |
| --- | --- |
| `plan.json` | The strategy: every post's category, slug, keyword, angle, wave, and required internal links (`must_link`). |
| `WRITER_BRIEF.md` | Voice, HTML, and linking rules every draft follows. |
| `posts/NN-<slug>.json` | The drafts (title, meta, excerpt, takeaways, FAQs, HTML body, links, editor notes, hero image idea). |
| `linkbacks.json` | Links that older posts gain when a newer wave goes live. |
| `existing/` | The 4 original posts with their new internal/external links, plus a backup of the content before any change. |
| `validate.py` | Checks a draft: lengths, banned phrases, no em dashes, allowed HTML, link rules (no links to later waves). |
| `build_sql.py` | Regenerates everything in `sql/` from the drafts and `linkbacks.json`. |

## Cluster map

| Wave | Cluster | Pillar | Spokes |
| --- | --- | --- | --- |
| 1 | Crawling (Technical SEO) | 1 Technical SEO audit checklist | 2 robots.txt, 3 XML sitemaps, 4 broken links, 5 301 vs 302 |
| 2 | Indexing (Technical SEO) | 6 Why Google isn't indexing your pages | 7 canonicals, 8 noindex vs disallow, 9 duplicate content, 10 orphan pages and internal linking |
| 3 | On-page SEO | 11 On-page SEO checklist | 12 title tags, 13 meta descriptions, 14 headings, 15 image SEO, 16 structured data |
| 4 | Web Performance, Accessibility | 17 Core Web Vitals | 18 JavaScript SEO, 19 mobile-first indexing, 20 accessibility and SEO |
| 5 | AI SEO, Offpage SEO | existing posts E2 and E3 act as pillars | 21 E-E-A-T, 22 AI Overviews, 23 broken link building, 24 local SEO |

The beginner's guide (E1) is the top-level hub and gains a link to each cluster's pillar as it goes live.

## Rollout

Each step uses `cd blog && npx wrangler d1 execute blog-db --remote --file content-plan/sql/<file>`.

1. **Once:** run `00-categories.sql` (adds On-page SEO, Web Performance, Accessibility), `01-existing-posts-links.sql` (links in the 4 original posts), and `02-drafts.sql` (all 24 posts as **drafts**, invisible to readers).
2. **Each wave, about a week apart:**
   1. In `/admin`, open each post of the wave, read it, work through its `editor_notes` (add your own experience, screenshots, data), add the hero image, then set status to Published. Publishing from the admin refreshes the cached pages.
   2. Run `wave-<n>-linkbacks.sql` to add links from older posts to the new ones (pages refresh within an hour).
   3. Request indexing for the pillar in Search Console's URL Inspection tool. The sitemap updates by itself.

Publish a whole wave together: posts inside a wave link to each other, so publishing only part of one leaves links to drafts (404s). Never publish a post before the waves it links to.

Link-back SQL is idempotent and safe to re-run. Each statement only fires while the exact sentence is still in the post, so a post you have edited by hand is left alone (the link-back is skipped, not broken).

## Changing a draft

Edit the JSON, run `python content-plan/validate.py <id>`, then `python content-plan/build_sql.py`. Once a draft is in D1, edit it in the admin instead; re-running `02-drafts.sql` skips slugs that already exist.
