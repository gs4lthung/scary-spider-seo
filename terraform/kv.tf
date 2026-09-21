# KV namespaces for ISR caching, rate limiting, monitoring, and notifications
#
# titles must match the exact names shown in the Cloudflare dashboard,
# otherwise Terraform will try to rename them on every plan.

# --- Production ---

resource "cloudflare_workers_kv_namespace" "isr_cache_prod" {
  account_id = var.cloudflare_account_id
  title      = "blog-isr-cache"
}

resource "cloudflare_workers_kv_namespace" "rate_limits_prod" {
  account_id = var.cloudflare_account_id
  title      = "RATE_LIMITS"
}

resource "cloudflare_workers_kv_namespace" "monitor_state" {
  account_id = var.cloudflare_account_id
  title      = "MONITOR_STATE"
}

resource "cloudflare_workers_kv_namespace" "comment_notif_state_prod" {
  account_id = var.cloudflare_account_id
  title      = "COMMENT_NOTIFICATION_STATE"
}

# --- Staging ---

resource "cloudflare_workers_kv_namespace" "isr_cache_staging" {
  account_id = var.cloudflare_account_id
  title      = "blog-isr-cache-staging"
}

resource "cloudflare_workers_kv_namespace" "rate_limits_staging" {
  account_id = var.cloudflare_account_id
  title      = "staging-RATE_LIMITS"
}

resource "cloudflare_workers_kv_namespace" "comment_notif_state_staging" {
  account_id = var.cloudflare_account_id
  title      = "staging-COMMENT_NOTIFICATION_STATE"
}
