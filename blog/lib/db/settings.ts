import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { settings } from "./schema";
import { CONTENT_PROMPT_KEY, DEFAULT_CONTENT_PROMPT } from "@/lib/content-prompt";

export const POSTS_PER_PAGE_KEY = "posts_per_page";
export const DEFAULT_POSTS_PER_PAGE = 9;
const MIN_POSTS_PER_PAGE = 1;
const MAX_POSTS_PER_PAGE = 50;

export function clampPostsPerPage(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_POSTS_PER_PAGE;
  return Math.min(MAX_POSTS_PER_PAGE, Math.max(MIN_POSTS_PER_PAGE, Math.round(value)));
}

export async function getPostsPerPage(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, POSTS_PER_PAGE_KEY));
  if (!row) return DEFAULT_POSTS_PER_PAGE;
  return clampPostsPerPage(Number(row.value));
}

export async function setPostsPerPage(value: number): Promise<void> {
  const db = await getDb();
  const clamped = clampPostsPerPage(value);
  await db
    .insert(settings)
    .values({ key: POSTS_PER_PAGE_KEY, value: String(clamped) })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(clamped) } });
}

export const COMMENTS_REQUIRE_APPROVAL_KEY = "comments_require_approval";
export const DEFAULT_COMMENTS_REQUIRE_APPROVAL = true;

export async function getCommentsRequireApproval(): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, COMMENTS_REQUIRE_APPROVAL_KEY));
  if (!row) return DEFAULT_COMMENTS_REQUIRE_APPROVAL;
  return row.value === "true";
}

export async function setCommentsRequireApproval(value: boolean): Promise<void> {
  const db = await getDb();
  const stored = value ? "true" : "false";
  await db
    .insert(settings)
    .values({ key: COMMENTS_REQUIRE_APPROVAL_KEY, value: stored })
    .onConflictDoUpdate({ target: settings.key, set: { value: stored } });
}

export async function getContentPrompt(): Promise<string> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, CONTENT_PROMPT_KEY));
  return row?.value || DEFAULT_CONTENT_PROMPT;
}

export async function setContentPrompt(value: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: CONTENT_PROMPT_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}
