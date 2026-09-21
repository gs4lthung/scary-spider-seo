# DNS records for scaryspiderseo.com
# The apex domain A record points to Cloudflare's proxy IPs.
# www and blog are CNAMEs routed through the Cloudflare proxy.

resource "cloudflare_dns_record" "apex" {
  zone_id = var.zone_id
  name    = var.zone_name
  type    = "A"
  content = "192.0.2.1" # Placeholder; Cloudflare proxy handles routing
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
  type    = "CNAME"
  content = "scary-spider-seo-blog.${var.zone_name}"
  ttl     = 1
  proxied = true
}
