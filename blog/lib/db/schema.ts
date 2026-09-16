import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImageKey: text("cover_image_key"),
  coverImageAlt: text("cover_image_alt"),
  // A single, freeform label shown as a pill on the post's card/hero image
  // (e.g. "Technical SEO", "Crawling"). Intentionally not a full taxonomy.
  category: text("category"),
  // SEO overrides: fall back to title/excerpt when left blank so every
  // post always has *something*, but let an editor tighten either one to
  // the ~60/155 char sweet spot without changing the on-page heading.
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
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
