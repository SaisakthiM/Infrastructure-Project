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

# ─── SHARED DATA TIER (see shared-data.tf) ────────────────────
# Admin credentials for the three shared instances. Apps never use these --
# each app gets its own least-privilege user built from the per-app
# variables above (blog_db_password, notes_db_user, ...).
variable "shared_pg_admin_password" {
  description = "Superuser ('postgres') password of the shared Postgres. Only the init container / you use it."
  type        = string
  sensitive   = true
}

variable "shared_mysql_root_password" {
  description = "root password of the shared MySQL. Only the init container / you use it. Must be a NEW value (blog/doc used to connect as root with their own password)."
  type        = string
  sensitive   = true
}

variable "shared_minio_root_user" {
  description = "MinIO root user of the shared MinIO. Must differ from every app's *_minio_user."
  type        = string
}

variable "shared_minio_root_password" {
  description = "MinIO root password of the shared MinIO (min 8 chars)."
  type        = string
  sensitive   = true
}

# MySQL app users. blog/doc used to connect as root; they now get their own
# user, with the existing blog_db_password / doc_db_password as its password.
variable "blog_db_user" {
  type    = string
  default = "blog"
}

variable "doc_db_user" {
  type    = string
  default = "doc"
}

# Buckets each app may touch. The MinIO policy is scoped to exactly these.
variable "blog_minio_buckets" {
  type    = list(string)
  default = ["blog-media"]
}

variable "doc_minio_buckets" {
  type    = list(string)
  default = ["documents"]
}

variable "whisper_minio_buckets" {
  description = "Buckets the whisper backend uses. No default on purpose -- check with: docker exec whisper-minio ls /data"
  type        = list(string)
}
