# Background Jobs

## Comment Notifications

Comment notifications use an isolated Cloudflare Queue pipeline.

```text
Comment Server Action
  -> D1 comment insert
  -> comment-notifications queue
  -> comment-notifications Worker
  -> Cloudflare Email Sending
```

Production resources:

- Queue: `comment-notifications`
- Dead-letter queue: `comment-notifications-dlq`
- Idempotency KV: `COMMENT_NOTIFICATION_STATE`
- Consumer Worker: `scary-spider-seo-comment-notifications`

Staging resources use the `-staging` suffix and are isolated from production.

The consumer batches up to 10 messages, waits up to 30 seconds to fill a batch, retries failed messages three times, and sends permanent failures to the dead-letter queue.

Set the recipient secret separately on each consumer Worker:

```bash
npx wrangler secret put ALERT_TO_EMAIL --config ops/comment-notifications/wrangler.jsonc
npx wrangler secret put ALERT_TO_EMAIL --config ops/comment-notifications/wrangler.jsonc --env staging
```

The same event ID, `comment:<id>`, is stored in the idempotency KV after successful delivery. Redelivered messages are skipped.

The producer treats the D1 insert as the primary operation. If queue publishing fails after the insert, the comment remains saved and the structured `comment_notification_enqueue_failed` log identifies the missing notification for investigation.

## Deferred Jobs

- Image processing remains client-side because uploads are already converted before R2 storage.
- Analytics remains a direct, rate-limited D1 update until write volume justifies batching.
- Sitemap revalidation remains synchronous because editorial changes are infrequent.
- Crawl report processing remains in the desktop application.

These jobs should move to Queues only when their latency, volume, or retry requirements justify the additional operational state.
