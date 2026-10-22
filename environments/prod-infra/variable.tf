variable "docker_host" {
  description = "Docker provider socket/endpoint, e.g. unix:///home/you/.docker/desktop/docker.sock"
}

variable "projects_dir" {
  description = "Absolute path to the projects/ directory containing all project source repos (Bank Manager, Blog Website, Whisper, etc). Auto-detected and written to terraform.tfvars by the CLI (social-platform configure)."
  type        = string
}

variable "n8n_env" {
  description = "Environment variables for the n8n container"
  type        = map(string)
}

variable "gitops_repo_url" {
  description = "Git URL ArgoCD pulls gitops/ from. Must match prod-social's value and the repo you actually push to."
  type        = string
  default     = "git@github.com:SaisakthiM/Infrastructure-Project.git"
}

# ---------------------------------------------------------------------------
# Everything below is kept only because `social-platform configure --regen`
# writes it into terraform.tfvars (an assignment with no declaration is a
# Terraform warning), and because the disabled redis path in others.tf reads
# it. Nothing live in main.tf uses var.observability_redis_password.
# ---------------------------------------------------------------------------
variable "observability_redis_password" {
  description = "Password for the observability redis. Originally hardcoded as a literal in the helm_release; now a real variable backing the kubectl_manifest in others.tf."
  type        = string
  sensitive   = true
  default     = "redis-password" # TODO: rotate -- this matched the old hardcoded value, change it
}

# domain, main_server_ip, smtp_user, smtp_password, atlantis_gh_user,
# atlantis_gh_token and atlantis_gh_webhook_secret used to be declared here
# even though only commented-out resources read them. A declaration without a
# `default` is mandatory, so `deploy` kept demanding values for services that
# are switched off. They now live, commented, at the bottom of others.tf.
