# Item 7: Background Jobs

## Objective

Use Cloudflare Queues for work that should not block a request, with retries, dead-letter handling, and idempotency.

## Status: Done

## What's Implemented

### Comment Notification Pipeline

```
Comment Server Action (blog/app/comments-actions.ts)
  -> D1 comment insert (primary operation)
  -> comment-notifications queue (best-effort publish)
  -> comment-notifications Worker (consumer)
  -> Cloudflare Email Sending (notification email)
```

### Queue Configuration

| Resource | Production | Staging |
|----------|-----------|---------|
| Main queue | `comment-notifications` | `comment-notifications-staging` |
| Dead-letter queue | `comment-notifications-dlq` | `comment-notifications-dlq-staging` |
| Consumer Worker | `scary-spider-seo-comment-notifications` | `scary-spider-seo-comment-notifications-staging` |
| Idempotency KV | `COMMENT_NOTIFICATION_STATE` (`3e3d1c...`) | `COMMENT_NOTIFICATION_STATE` (`e17081...`) |

### Consumer Settings

| Setting | Value |
|---------|-------|
| `max_batch_size` | 10 |
| `max_batch_timeout` | 30 seconds |
| `max_retries` | 3 |
| `retry_delay` | 60 seconds |
| Dead-letter queue | On permanent failure |

### Idempotency

- Each comment gets an event ID: `comment:<id>`
- After successful email send, event ID stored in KV with `processed:` prefix
- Redelivered messages are detected and skipped
- KV keys auto-expire after 24 hours

### Error Handling

- D1 insert is the primary operation (comment is always saved)
- Queue publish failure is logged but does not fail the request
- Consumer validates message schema before processing
- Permanent failures go to dead-letter queue for investigation

## How It Works

```
1. User submits comment
2. Turnstile token verified
3. Comment inserted into D1
4. Queue message published (best-effort)
5. If queue publish fails: comment still saved, failure logged
6. Consumer picks up message (batch of up to 10)
7. Checks idempotency KV (skip if already processed)
8. Sends notification email via Cloudflare Email Sending
9. Stores event ID in KV
10. On failure: retry up to 3 times, then dead-letter queue
```

## How to Verify

```bash
# Deploy consumer Worker
npx wrangler deploy ops/comment-notifications/src/index.ts --config ops/comment-notifications/wrangler.jsonc

# Check dead-letter queue
npx wrangler queues message list comment-notifications-dlq

# Set email secret
npx wrangler secret put ALERT_TO_EMAIL --config ops/comment-notifications/wrangler.jsonc
npx wrangler secret put ALERT_TO_EMAIL --config ops/comment-notifications/wrangler.jsonc --env staging
```

## Deferred Jobs

| Job | Reason Deferred |
|-----|-----------------|
| Image processing | Already done client-side before R2 upload |
| Analytics batching | Low write volume, direct D1 update is fine |
| Sitemap revalidation | Infrequent editorial changes |
| Crawl report processing | Handled in desktop application |

These should move to Queues only when latency, volume, or retry requirements justify the additional operational state.

## Gaps / TODO

- `ALERT_TO_EMAIL` secret must be set on both production and staging consumer Workers
- No monitoring of queue depth or consumer lag
- No dead-letter queue investigation tooling
