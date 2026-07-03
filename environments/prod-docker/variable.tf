variable "docker_host" {
  description = "Docker provider socket/endpoint, e.g. unix:///home/you/.docker/desktop/docker.sock"
}

variable "projects_dir" {
  description = "Absolute path to the projects/ directory containing all project source repos (Bank Manager, Blog Website, Whisper, etc). Auto-detected and written to terraform.tfvars by the CLI (social-platform configure)."
  type        = string
}

# ─── BLOG ─────────────────────────────────────────────────────
variable "blog_db_password"    { sensitive = true }
variable "blog_db_name"        {}
variable "blog_minio_user"     {}
variable "blog_minio_password" { sensitive = true }
variable "blog_secret_key"     { sensitive = true }
variable "blog_allowed_hosts"  {}

# ─── NOTES ────────────────────────────────────────────────────
variable "notes_db_name"       {}
variable "notes_db_user"       {}
variable "notes_db_password"   { sensitive = true }

# ─── BANK ─────────────────────────────────────────────────────
variable "bank_db_user"        {}
variable "bank_db_password"    { sensitive = true }
variable "bank_db_name"        {}

# ─── DOCUMENT INTELLIGENCE PLATFORM ──────────────────────────
variable "doc_db_password"       { sensitive = true }
variable "doc_db_name"           {}
variable "doc_minio_user"        {}
variable "doc_minio_password"    { sensitive = true }
variable "doc_gemini_api_key"    { sensitive = true }
variable "doc_django_secret_key" { sensitive = true }

# ─── API SERVICE ──────────────────────────────────────────────
variable "api_key_weather"     { sensitive = true }

# ─── WHISPER APP ──────────────────────────────────────────────
variable "whisper_db_user"        {}
variable "whisper_db_password"    { sensitive = true }
variable "whisper_db_database"    {}
variable "whisper_db_test_db"     {}
variable "whisper_minio_user"     {}
variable "whisper_minio_password" { sensitive = true }
variable "whisper_jwt_secret"     { sensitive = true }
variable "whisper_domain" { }
variable "compiler_domain" { }