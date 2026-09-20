import { sqliteTable, text, integer, uniqueIndex, index, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  // "Key takeaways" rendered as a highlighted bulleted box near the top of
  // the post. Stored as a JSON string array.
  keyTakeaways: text("key_takeaways"),
  // FAQ section rendered after the content and exposed as FAQPage schema.
  // Stored as a JSON array of { question, answer }.
  faqs: text("faqs"),
  coverImageKey: text("cover_image_key"),
  coverImageAlt: text("cover_image_alt"),
  // The user credited as the post's author (shown as an author card on the
  // post and on /author/<username>). Nullable so pre-existing posts have no
  // author until one is assigned.
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  // A single, freeform label shown as a pill on the post's card/hero image
  // (e.g. "Technical SEO", "Crawling"). Intentionally not a full taxonomy.
  category: text("category"),
  // SEO overrides: fall back to title/excerpt when left blank so every
  // post always has *something*, but let an editor tighten either one to
  // the ~60/155 char sweet spot without changing the on-page heading.
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  // Optional editorial override; null uses the content-based estimate.
  readingTime: integer("reading_time"),
  status: text("status", { enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull().unique(),
});

// Site-wide key/value config editable from /admin/settings (currently just
// how many posts show per page on the public listing). A single freeform
// table rather than dedicated columns since it's likely to grow.
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "editor"] })
    .notNull()
    .default("editor"),
  // Public author profile, surfaced on /author/<username> and author cards.
  displayName: text("display_name"),
  // R2 media path (e.g. "/media/<key>") for the avatar, like coverImageKey.
  avatarKey: text("avatar_key"),
  jobTitle: text("job_title"),
  bio: text("bio"),
  // Optional public links shown on the author profile. Handles/handles are
  // normalized to full URLs when rendered (see components/SocialLinks.tsx).
  website: text("website"),
  email: text("email"),
  github: text("github"),
  twitter: text("twitter"),
  linkedin: text("linkedin"),
  facebook: text("facebook"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references((): AnySQLiteColumn => comments.id, { onDelete: "cascade" }),
  // Null for anonymous commenters (the only kind today). Once accounts are
  // required, new comments carry a userId and authorName just mirrors it;
  // until then authorName is whatever the anonymous commenter typed.
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  // HMAC'd, not a raw IP (see lib/anti-spam.ts) — used only to rate-limit
  // rapid-fire anonymous submissions from the same submitter.
  ipHash: text("ip_hash"),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const commentVotes = sqliteTable(
  "comment_votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    // An anonymous per-browser id (cookie) for now, since there's no login
    // yet to key votes on; becomes a userId-based key once accounts land.
    voterKey: text("voter_key").notNull(),
    value: integer("value").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("comment_votes_comment_voter_unique").on(table.commentId, table.voterKey)],
);

// Failed login attempts keyed by the HMAC'd IP hash (same scheme as
// comments' ip_hash, see lib/anti-spam.ts), used to rate-limit the admin
// login. Rows older than the lockout window are pruned on each check.
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ipHash: text("ip_hash").notNull(),
    attemptedAt: integer("attempted_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("login_attempts_ip_hash_idx").on(table.ipHash)],
);
