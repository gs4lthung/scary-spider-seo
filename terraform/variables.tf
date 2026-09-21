variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers, D1, R2, KV, Queues, DNS, and Rulesets permissions"
  type        = string
  sensitive   = true
}

variable "zone_id" {
  description = "Cloudflare zone ID for scaryspiderseo.com"
  type        = string
}

variable "zone_name" {
  description = "Primary domain name"
  type        = string
  default     = "scaryspiderseo.com"
}
