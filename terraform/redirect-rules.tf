# www to non-www redirect rule
# Uses a Cloudflare Ruleset (Single Redirect) to 301 redirect
# https://www.scaryspiderseo.com/* to https://scaryspiderseo.com/*

resource "cloudflare_ruleset" "www_redirect" {
  zone_id     = var.zone_id
  name        = "www-to-root"
  description = "Redirect www to root domain"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules = [
    {
      expression  = "(http.request.full_uri eq \"https://www.scaryspiderseo.com/\") or (http.host eq \"www.scaryspiderseo.com\")"
      description = "Redirect www to root"
      action      = "redirect"
      action_parameters = {
        from_value = {
          status_code = 301
          target_url = {
            expression = "wildcard_replace(http.request.full_uri, r\"https://www.*\", r\"https://${1}\")"
          }
          preserve_query_string = true
        }
      }
      enabled = true
    }
  ]
}
