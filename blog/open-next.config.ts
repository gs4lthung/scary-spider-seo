import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import kvNextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// Pages use `export const revalidate = 3600` (ISR) and server actions call
// `revalidatePath()`. OpenNext only honors those when a real incremental
// cache is configured; the default "dummy" cache silently no-ops both.
// These overrides back ISR caching and path revalidation with the KV
// namespace bound as NEXT_INC_CACHE_KV / NEXT_TAG_CACHE_KV in wrangler.jsonc.
// Both bindings point at the same KV namespace (blog-isr-cache).
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: kvNextTagCache,
  queue: memoryQueue,
});