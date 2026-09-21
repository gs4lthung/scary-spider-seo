# Queues for comment notifications (production and staging)
# Each main queue has a dead-letter queue for permanently failed messages.

# --- Production ---

resource "cloudflare_queue" "comment_notif" {
  account_id = var.cloudflare_account_id
  queue_name = "comment-notifications"
}

resource "cloudflare_queue" "comment_notif_dlq" {
  account_id = var.cloudflare_account_id
  queue_name = "comment-notifications-dlq"
}

# --- Staging ---

resource "cloudflare_queue" "comment_notif_staging" {
  account_id = var.cloudflare_account_id
  queue_name = "comment-notifications-staging"
}

resource "cloudflare_queue" "comment_notif_dlq_staging" {
  account_id = var.cloudflare_account_id
  queue_name = "comment-notifications-dlq-staging"
}
