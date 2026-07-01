variable "docker_host" {
  description = "Docker provider socket/endpoint, e.g. unix:///home/you/.docker/desktop/docker.sock"
}

variable "projects_dir" {
  description = "Absolute path to the projects/ directory containing all project source repos (Bank Manager, Blog Website, Whisper, etc). Auto-detected and written to terraform.tfvars by the CLI (social-platform configure)."
  type        = string
}

# ─── n8n ────────────────────────────────────────────────────
variable "main_server_ip" {
  description = "IP of your main server — used by n8n to reach apps"
  type        = string
  default     = "192.168.31.227"
}

variable "domain" {
  description = "Your public domain"
  type        = string
  default     = "saisakthi.qzz.io"
}

variable "n8n_env" {
  description = "Environment variables for the n8n container"
  type        = map(string)
}

# ─── Observability ──────────────────────────────────────────
variable "observability_redis_password" {
  description = "Password for the Bitnami redis used by the observability stack. Originally hardcoded as a literal in the helm_release; now a real variable backing a Terraform-managed Secret."
  type        = string
  sensitive   = true
  default     = "redis-password" # TODO: rotate -- this matched the old hardcoded value, change it
}

variable "gitops_repo_url" {
  description = "Git URL ArgoCD pulls gitops/ from. Must match prod-social's value and the repo you actually push to."
  type        = string
  default     = "git@github.com:SaisakthiM/Coding-Project.git"
}

# ─── Atlantis ───────────────────────────────────────────────
variable "atlantis_gh_user" {
  description = "GitHub username Atlantis authenticates and comments as."
  type        = string
}

variable "atlantis_gh_token" {
  description = "Personal access token for atlantis_gh_user. Needs 'repo' scope (or 'public_repo' if Coding-Project is public) so Atlantis can read PR status, post comments, and set commit statuses."
  type        = string
  sensitive   = true
}

variable "atlantis_gh_webhook_secret" {
  description = "Shared secret Atlantis uses to verify GitHub webhook payloads are genuinely from GitHub. Generate with `openssl rand -hex 32`; the exact same string has to be pasted into the webhook's 'Secret' field in GitHub's repo settings."
  type        = string
  sensitive   = true
}
