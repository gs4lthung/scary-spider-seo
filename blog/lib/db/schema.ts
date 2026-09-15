import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
