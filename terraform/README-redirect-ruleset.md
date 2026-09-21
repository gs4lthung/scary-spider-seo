# Redirect Ruleset

The www-to-root redirect is managed in the Cloudflare dashboard (Single Redirects).
It's not in Terraform because the API token needs "Rulesets Read" permission.

Rule: `http.request.full_uri eq "https://www.scaryspiderseo.com/" or http.host eq "www.scaryspiderseo.com"`
Action: 301 redirect to `https://${1}` (wildcard replace)

To add this to Terraform later:
1. Add "Rulesets Read" permission to the API token (Zone scope)
2. Import the existing ruleset:
   ```
   terraform import cloudflare_ruleset.www_redirect <zone_id>/<ruleset_id>
   ```
3. Re-create redirect-rules.tf with the matching config
