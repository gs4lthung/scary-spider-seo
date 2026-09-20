import type { Config } from "drizzle-kit";

// Only used for `drizzle-kit generate` (schema -> SQL migration files).
// Migrations are then applied with `wrangler d1 migrations apply`, so no
// live DB credentials are needed here.
export default {
  schema: "./lib/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
} satisfies Config;
