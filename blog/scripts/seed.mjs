// Seeds the local D1 database with a demo user, categories, settings, and a
// handful of posts (published + draft). Wipes existing blog rows first, so it
// is safe to re-run ("everything again").
//
// Usage: npm run db:seed
// Default admin password: admin12345
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webcrypto as crypto } from "node:crypto";

const PASSWORD = process.argv[2] || "admin12345";

function sql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return `${Buffer.from(salt).toString("base64")}:${Buffer.from(bits).toString("base64")}`;
}

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

function post({ title, slug, excerpt, content, takeaways, faqs, category, status, publishedDaysAgo }) {
  const publishedAt = status === "published" ? now - publishedDaysAgo * day : null;
  const values = [
    sql(slug),
    sql(title),
    sql(excerpt ?? ""),
    sql(content),
    sql(takeaways ? JSON.stringify(takeaways) : ""),
    sql(faqs ? JSON.stringify(faqs) : ""),
    "NULL",
    "NULL",
    "(SELECT id FROM users WHERE username = 'admin')",
    category ? sql(category) : "NULL",
    sql(title),
    sql(excerpt ?? ""),
    sql(status),
    publishedAt ? String(publishedAt) : "NULL",
    String(now),
    String(now),
  ];
  return `INSERT INTO posts (slug, title, excerpt, content, key_takeaways, faqs, cover_image_key, cover_image_alt, author_id, category, meta_title, meta_description, status, published_at, created_at, updated_at) VALUES (${values.join(", ")});`;
}

const posts = [
  post({
    title: "Why Your Website Might Be Invisible to Google",
    slug: "why-your-website-might-be-invisible-to-google",
    excerpt: "Crawl visibility comes before rankings. Find out why your best pages might never reach Google.",
    category: "Technical SEO",
    status: "published",
    publishedDaysAgo: 12,
    content:
      "<h2>Invisible pages cost you rankings</h2><p>A page that Google never crawls cannot rank, no matter how good it is. The first step in any SEO audit is figuring out which of your pages the search engine actually reached.</p><h3>Common causes</h3><ul><li>A robots.txt directive that blocks the section</li><li>Links that are only reachable through JavaScript</li><li>Orphan pages with no internal links pointing at them</li></ul><p>Use a crawler to find every page, then fix the blockers one by one.</p><h2>Check your internal links</h2><p>Every page that matters should be reachable from the home page in a handful of clicks. If a page exists but nothing links to it, the crawler may never find it.</p>",
    takeaways: [
      "Crawl visibility comes before rankings",
      "Check robots.txt before assuming pages are indexed",
      "Orphan pages are invisible pages",
    ],
    faqs: [
      { question: "How do I know if Google crawled my page?", answer: "Check the URL in Search Console or look for the page in a site: search." },
      { question: "Does JavaScript content get crawled?", answer: "Yes, but it is slower and can fail; server-rendered content is more reliable." },
    ],
  }),
  post({
    title: "A Beginner's Guide to SEO",
    slug: "a-beginners-guide-to-seo",
    excerpt: "The fundamentals explained simply: how search engines crawl, index, and rank your pages.",
    category: "Content",
    status: "published",
    publishedDaysAgo: 8,
    content:
      "<h2>How search engines work</h2><p>Search engines crawl the web by following links, index what they find, and then rank pages against a query. If any step breaks, your page disappears.</p><h2>Start with a title and a meta description</h2><p>The title tag is the biggest on-page signal. Write a unique, descriptive title under 60 characters and pair it with a meta description around 155 characters.</p><h3>Make it easy to crawl</h3><p>Good internal linking and a clean URL structure help every page get found.</p>",
    takeaways: [
      "Crawl, index, rank is the order that matters",
      "Titles and meta descriptions are the first thing users see",
      "Internal links are how crawlers discover pages",
    ],
    faqs: [
      { question: "How long does SEO take?", answer: "Expect meaningful movement in three to six months for a new site." },
      { question: "Do I need to submit my site to Google?", answer: "No, but a sitemap and a few external links speed up discovery." },
    ],
  }),
  post({
    title: "Internal Linking That Actually Helps Crawlers",
    slug: "internal-linking-that-actually-helps-crawlers",
    excerpt: "Descriptive anchor text and a shallow hierarchy make it easy for crawlers to find everything.",
    category: "Technical SEO",
    status: "published",
    publishedDaysAgo: 4,
    content:
      "<h2>Links are the crawler's map</h2><p>Internal links tell a crawler which pages exist and what they are about. Descriptive anchor text beats generic words like \"click here\".</p><h2>Keep important pages close to home</h2><p>Pages that matter should be a few clicks from the home page. A shallow hierarchy means fewer hops and a stronger signal.</p><h3>Prune dead ends</h3><p>Every page should have at least one link pointing to it. If a page is linked from nowhere, the crawler has no reason to visit.</p>",
    takeaways: [
      "Anchor text should describe the target page",
      "Important pages should be a few clicks from home",
      "Every page needs at least one internal link",
    ],
  }),
  post({
    title: "How to Write Meta Descriptions People Click",
    slug: "how-to-write-meta-descriptions-people-click",
    excerpt: "A draft on turning the humble meta description into a conversion tool.",
    category: "Content",
    status: "draft",
    content:
      "<h2>Why the meta description matters</h2><p>It is the snippet under your result. It does not affect rankings directly, but it decides whether searchers click.</p><h2>Write like a headline</h2><p>Lead with the benefit, add a number or a promise, and stay under 155 characters so it is not truncated.</p>",
    takeaways: ["Meta descriptions are click-through levers, not ranking factors", "Keep them under 155 characters"],
  }),
  post({
    title: "Notes on the 2026 Crawling Season",
    slug: "notes-on-the-2026-crawling-season",
    excerpt: "Uncategorized notes to prove that posts without a category still live at a flat URL.",
    status: "published",
    publishedDaysAgo: 1,
    content:
      "<h2>What we saw this year</h2><p>Budgets keep shifting toward quality. Pages that load fast and answer the query directly get crawled more often.</p>",
  }),
];

const hash = await hashPassword(PASSWORD);

const userValues = [
  sql("admin"),
  sql(hash),
  sql("admin"),
  sql("Scary Spider Admin"),
  "NULL",
  sql("Head of SEO"),
  sql("I write about crawling, indexing, and making websites easy for search engines to understand."),
  sql("https://www.scaryspiderseo.com"),
  sql("hello@scaryspiderseo.com"),
  sql("scaryspider"),
  sql("scaryspider"),
  "NULL",
  "NULL",
  String(now),
];

const sqlStatements = [
  "DELETE FROM comment_votes;",
  "DELETE FROM comments;",
  "DELETE FROM login_attempts;",
  "DELETE FROM posts;",
  "DELETE FROM categories;",
  "DELETE FROM users;",
  "DELETE FROM settings;",
  "INSERT INTO settings (key, value) VALUES ('posts_per_page', '9');",
  "INSERT INTO settings (key, value) VALUES ('comments_require_approval', 'true');",
  "INSERT INTO categories (slug, name) VALUES ('technical-seo', 'Technical SEO');",
  "INSERT INTO categories (slug, name) VALUES ('content', 'Content');",
  `INSERT INTO users (username, password_hash, role, display_name, avatar_key, job_title, bio, website, email, github, twitter, linkedin, facebook, created_at) VALUES (${userValues.join(", ")});`,
  ...posts,
].join("\n");

const dir = mkdtempSync(join(tmpdir(), "blog-seed-"));
const file = join(dir, "seed.sql");
writeFileSync(file, sqlStatements, "utf8");

execSync(`npx wrangler d1 execute blog-db --local --file="${file}"`, { stdio: "inherit" });

console.log(`\nSeeded local D1. Admin login: username "admin", password "${PASSWORD}".`);