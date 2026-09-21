# DNS records for scaryspiderseo.com
# Proxied Worker domains use AAAA records with Cloudflare's 100:: placeholder.

resource "cloudflare_dns_record" "apex" {
  zone_id = var.zone_id
  name    = var.zone_name
  type    = "AAAA"
  content = "100::"
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "www" {
  zone_id = var.zone_id
  name    = "www"
  type    = "CNAME"
  content = var.zone_name
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "blog" {
  zone_id = var.zone_id
  name    = "blog"
  type    = "AAAA"
  content = "100::"
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "blog_staging" {
  zone_id = var.zone_id
  name    = "staging-blog"
  type    = "AAAA"
  content = "100::"
  ttl     = 1
  proxied = true
}
