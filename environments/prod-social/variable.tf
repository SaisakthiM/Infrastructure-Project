variable "docker_host" {
  description = "Docker provider socket/endpoint, e.g. unix:///home/you/.docker/desktop/docker.sock"
}

variable "projects_dir" {
  description = "Absolute path to the projects/ directory containing all project source repos (Bank Manager, Blog Website, Whisper, etc). Auto-detected and written to terraform.tfvars by the CLI (social-platform configure)."
  type        = string
}

# ─── SOCIAL MEDIA ─────────────────────────────────────────────
# social_db_name / social_db_user were dropped as variables -- they're
# non-secret identifiers, now hardcoded literally in
# gitops/social-media/raw/03-postgres-statefulset.yaml and
# gitops/social-media/raw/05-backend-deployment.yaml ("socialdb" / "admin").
variable "social_db_password" { sensitive = true }
variable "social_minio_user"  {}
variable "social_minio_password" { sensitive = true }

variable "load_images" {
  type    = bool
  default = false
}

variable "gitops_repo_url" {
  description = "Git URL ArgoCD pulls gitops/ from. Must match the repo you push this whole infra/ tree to."
  type        = string
  default     = "git@github.com:SaisakthiM/Infrastructure-Project.git"
}

variable "gitops_repo_ssh_key" {
  type      = string
  sensitive = true
}
