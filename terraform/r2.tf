# R2 buckets for media storage and database backups

resource "cloudflare_r2_bucket" "blog_media" {
  account_id = var.cloudflare_account_id
  name       = "blog-media"
  location   = "apac"
}

resource "cloudflare_r2_bucket" "blog_media_staging" {
  account_id = var.cloudflare_account_id
  name       = "blog-media-staging"
  location   = "apac"
}

resource "cloudflare_r2_bucket" "blog_db_backups" {
  account_id = var.cloudflare_account_id
  name       = "blog-db-backups"
  location   = "apac"
}
