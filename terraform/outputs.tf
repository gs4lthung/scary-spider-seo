output "d1_database_ids" {
  value = {
    blog_db          = cloudflare_d1_database.blog_db.id
    blog_db_staging  = cloudflare_d1_database.blog_db_staging.id
  }
  description = "D1 database IDs (reference in wrangler.jsonc)"
}

output "r2_bucket_names" {
  value = {
    blog_media         = cloudflare_r2_bucket.blog_media.name
    blog_media_staging = cloudflare_r2_bucket.blog_media_staging.name
    blog_db_backups    = cloudflare_r2_bucket.blog_db_backups.name
  }
  description = "R2 bucket names"
}

output "kv_namespace_ids" {
  value = {
    isr_cache_prod          = cloudflare_workers_kv_namespace.isr_cache_prod.id
    rate_limits_prod        = cloudflare_workers_kv_namespace.rate_limits_prod.id
    monitor_state           = cloudflare_workers_kv_namespace.monitor_state.id
    comment_notif_state_prod = cloudflare_workers_kv_namespace.comment_notif_state_prod.id
    isr_cache_staging       = cloudflare_workers_kv_namespace.isr_cache_staging.id
    rate_limits_staging     = cloudflare_workers_kv_namespace.rate_limits_staging.id
    comment_notif_state_staging = cloudflare_workers_kv_namespace.comment_notif_state_staging.id
  }
  description = "KV namespace IDs"
}

output "queue_names" {
  value = {
    comment_notif        = cloudflare_queue.comment_notif.queue_name
    comment_notif_dlq    = cloudflare_queue.comment_notif_dlq.queue_name
    comment_notif_staging     = cloudflare_queue.comment_notif_staging.queue_name
    comment_notif_dlq_staging = cloudflare_queue.comment_notif_dlq_staging.queue_name
  }
  description = "Queue names"
}
