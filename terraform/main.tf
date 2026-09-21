terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
  }

  # Local state for now. Switch to remote (R2 backend) for team collaboration.
  # backend "s3" {
  #   bucket                      = "terraform-state"
  #   key                         = "scary-spider-seo/terraform.tfstate"
  #   endpoints                   = { s3 = "https://<account-id>.r2.cloudflarestorage.com" }
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_requesting_account_id  = true
  # }
}
