# D1 databases for the blog (production and staging)

resource "cloudflare_d1_database" "blog_db" {
  account_id = var.cloudflare_account_id
  name       = "blog-db"
}

resource "cloudflare_d1_database" "blog_db_staging" {
  account_id = var.cloudflare_account_id
  name       = "blog-db-staging"
}
