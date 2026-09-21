# www-to-root redirect (imported from Cloudflare dashboard)
# Managed via Single Redirects in the Cloudflare UI.

resource "cloudflare_ruleset" "www_redirect" {
  zone_id     = var.zone_id
  name        = "default"
  description = ""
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  lifecycle { ignore_changes = [rules] }

  rules = [
    {
      description = "Redirect from WWW to root"
      enabled     = true
      expression  = "(http.request.full_uri wildcard r\"https://www.*\")"
      action      = "redirect"
      action_parameters = {
        from_value = {
          status_code           = 301
          preserve_query_string = false
          target_url = {
            expression = "wildcard_replace(http.request.full_uri, r\"https://www.*\", r\"https://$${1}\")"
          }
        }
      }
    },
  ]
}
