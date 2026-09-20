# ---------------------------------------------------------------------------
# Shared data tier: ONE Postgres, ONE MySQL, ONE MinIO for every app in this
# state (notes, bank, whisper / blog, doc / blog, doc, whisper).
#
# Each app gets its own user + its own database (or bucket). Backends need no
# code change: only the host and (for blog/doc MySQL) the user in their env
# change. Credentials keep coming from the same variables as before.
#
# Users/databases/buckets are created by one-shot "init" containers (same
# pattern as the old blog_minio_init). They are idempotent, and re-run
# automatically whenever an app's user/password/db/bucket list changes,
# because their inputs (env + uploaded files) force a replacement.
#
# Not in here on purpose: prod-social (kind cluster / gitops) and compiler-db
# (custom database, not Postgres).
# ---------------------------------------------------------------------------

locals {
  shared_pg_host    = "shared-postgres"
  shared_mysql_host = "shared-mysql"
  shared_minio_host = "shared-minio"

  # ── Who gets what ────────────────────────────────────────────────────────
  pg_apps = {
    notes = {
      user     = var.notes_db_user
      password = var.notes_db_password
      dbs      = [var.notes_db_name]
    }
    bank = {
      user     = var.bank_db_user
      password = var.bank_db_password
      dbs      = [var.bank_db_name]
    }
    whisper = {
      user     = var.whisper_db_user
      password = var.whisper_db_password
      dbs      = [var.whisper_db_database, var.whisper_db_test_db]
    }
  }

  mysql_apps = {
    blog = {
      user     = var.blog_db_user
      password = var.blog_db_password
      dbs      = [var.blog_db_name]
    }
    doc = {
      user     = var.doc_db_user
      password = var.doc_db_password
      dbs      = [var.doc_db_name]
    }
  }

  minio_apps = {
    blog = {
      user     = var.blog_minio_user
      password = var.blog_minio_password
      buckets  = var.blog_minio_buckets
      # Old blog_minio_init ran `mc anonymous set download` on blog-media
      # (nginx serves it publicly at /blog/minio/). Kept.
      public_buckets = var.blog_minio_buckets
    }
    doc = {
      user           = var.doc_minio_user
      password       = var.doc_minio_password
      buckets        = var.doc_minio_buckets
      public_buckets = []
    }
    whisper = {
      user           = var.whisper_minio_user
      password       = var.whisper_minio_password
      buckets        = var.whisper_minio_buckets
      public_buckets = []
    }
  }

  # ── Postgres init SQL (runs as superuser, via psql -f) ───────────────────
  # Standard-conforming strings are on by default, so only ' needs doubling.
  pg_init_sql = join("\n", flatten([
    for k, a in local.pg_apps : concat(
      [
        "SELECT 'CREATE ROLE \"${a.user}\" LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${a.user}')\\gexec",
        "ALTER ROLE \"${a.user}\" WITH LOGIN PASSWORD '${replace(a.password, "'", "''")}';",
      ],
      flatten([
        for d in distinct(a.dbs) : [
          "SELECT 'CREATE DATABASE \"${d}\" OWNER \"${a.user}\"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${d}')\\gexec",
          "ALTER DATABASE \"${d}\" OWNER TO \"${a.user}\";",
          # other apps' users must not be able to connect to this database
          "REVOKE ALL ON DATABASE \"${d}\" FROM PUBLIC;",
        ]
      ])
    )
  ]))

  # ── MySQL init SQL (runs as root) ────────────────────────────────────────
  # Escape \ and ' for the string literal; escape _ in GRANT db names, where
  # it is otherwise a single-character wildcard.
  mysql_init_sql = join("\n", flatten([
    for k, a in local.mysql_apps : concat(
      [
        "CREATE USER IF NOT EXISTS '${a.user}'@'%' IDENTIFIED BY '${replace(replace(a.password, "\\", "\\\\"), "'", "\\'")}';",
        "ALTER USER '${a.user}'@'%' IDENTIFIED BY '${replace(replace(a.password, "\\", "\\\\"), "'", "\\'")}';",
      ],
      flatten([
        for d in distinct(a.dbs) : [
          "CREATE DATABASE IF NOT EXISTS `${d}`;",
          "GRANT ALL PRIVILEGES ON `${replace(d, "_", "\\_")}`.* TO '${a.user}'@'%';",
        ]
      ])
    )
  ]))

  # ── MinIO: one policy per app, limited to that app's buckets ─────────────
  minio_policies = {
    for k, a in local.minio_apps : k => jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect   = "Allow"
          Action   = ["s3:ListAllMyBuckets"]
          Resource = ["arn:aws:s3:::*"]
        },
        {
          Effect = "Allow"
          Action = ["s3:*"]
          Resource = flatten([
            for b in a.buckets : ["arn:aws:s3:::${b}", "arn:aws:s3:::${b}/*"]
          ])
        },
      ]
    })
  }

  minio_init_header = <<-EOT
    set -eu
    i=0
    until mc alias set shared http://shared-minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
      i=$((i+1))
      [ "$i" -lt 60 ] || { echo "MinIO not ready" >&2; exit 1; }
      echo "Waiting for MinIO..."; sleep 2
    done
    # attaching an already-attached policy is an error in mc; treat that as success
    attach_policy() {
      out=$(mc admin policy attach shared "$1" --user "$2" 2>&1) || {
        echo "$out" | grep -qi already || { echo "$out" >&2; exit 1; }
      }
    }
  EOT

  minio_init_apps = join("\n", flatten([
    for k, a in local.minio_apps : concat(
      ["mc admin user add shared \"$APP_${upper(k)}_USER\" \"$APP_${upper(k)}_PASS\""],
      [for b in a.buckets : "mc mb --ignore-existing shared/${b}"],
      [
        "mc admin policy create shared app-${k} /policy-${k}.json",
        "attach_policy app-${k} \"$APP_${upper(k)}_USER\"",
      ],
      [for b in a.public_buckets : "mc anonymous set download shared/${b}"],
    )
  ]))

  minio_init_script = "${local.minio_init_header}\n${local.minio_init_apps}\necho 'Shared MinIO setup complete'"
}

# ---------------------------------------------------------------------------
# Volumes. The old per-app volumes (notes_pgdata, blog_mysql, ...) are still
# declared in main.tf so their data survives until you delete them by hand.
# ---------------------------------------------------------------------------
resource "docker_volume" "shared_pgdata" { name = "gateway_shared-pgdata" }
resource "docker_volume" "shared_mysql" { name = "gateway_shared-mysql" }
resource "docker_volume" "shared_minio" { name = "gateway_shared-minio" }

# ---------------------------------------------------------------------------
# Postgres
# ---------------------------------------------------------------------------
resource "docker_container" "shared_postgres" {
  # was 384 + 512 + 384 across three instances
  memory                = 768
  cpus                  = "0.8"
  name                  = local.shared_pg_host
  image                 = "postgres:16-alpine"
  restart               = "always"
  destroy_grace_seconds = 30
  must_run              = true
  env = [
    "POSTGRES_USER=postgres",
    "POSTGRES_PASSWORD=${var.shared_pg_admin_password}",
  ]
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.shared_pgdata.name
    target = "/var/lib/postgresql/data"
    type   = "volume"
  }
  healthcheck {
    test         = ["CMD-SHELL", "pg_isready -U postgres"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "20s"
  }
}

resource "docker_container" "shared_postgres_init" {
  memory     = 64
  cpus       = "0.1"
  name       = "shared-postgres-init"
  image      = "postgres:16-alpine"
  must_run   = false
  restart    = "no"
  attach     = true
  logs       = true
  entrypoint = ["/bin/sh", "-c"]
  command = [
    <<-EOT
      set -eu
      i=0
      until pg_isready -q -h ${local.shared_pg_host} -U postgres; do
        i=$((i+1))
        [ "$i" -lt 60 ] || { echo "Postgres not ready" >&2; exit 1; }
        sleep 2
      done
      psql -v ON_ERROR_STOP=1 -h ${local.shared_pg_host} -U postgres -d postgres -f /init.sql
      echo "Shared Postgres setup complete"
    EOT
  ]
  env = ["PGPASSWORD=${var.shared_pg_admin_password}"]
  upload {
    file    = "/init.sql"
    content = local.pg_init_sql
  }
  networks_advanced { name = "gateway-net" }
  depends_on = [docker_container.shared_postgres]

  lifecycle {
    precondition {
      condition     = alltrue([for a in values(local.pg_apps) : a.user != "postgres"])
      error_message = "A Postgres app user is set to 'postgres'. That is the shared superuser -- init would overwrite its password. Pick a different *_db_user in your tfvars (the migration script handles the rename)."
    }
    precondition {
      condition = alltrue(flatten([
        for a in values(local.pg_apps) : concat([can(regex("^[A-Za-z_][A-Za-z0-9_-]*$", a.user))], [for d in a.dbs : can(regex("^[A-Za-z_][A-Za-z0-9_-]*$", d))])
      ]))
      error_message = "Postgres user/database names may only contain letters, digits, '_' and '-' (and must not start with a digit)."
    }
  }
}

# ---------------------------------------------------------------------------
# MySQL
# ---------------------------------------------------------------------------
resource "docker_container" "shared_mysql" {
  # was 512 + 512 across two instances
  memory  = 768
  cpus    = "0.7"
  name    = local.shared_mysql_host
  image   = "mysql:8.0"
  restart = "always"
  env     = ["MYSQL_ROOT_PASSWORD=${var.shared_mysql_root_password}"]
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.shared_mysql.name
    target = "/var/lib/mysql"
    type   = "volume"
  }
  healthcheck {
    test         = ["CMD-SHELL", "MYSQL_PWD=\"$MYSQL_ROOT_PASSWORD\" mysqladmin ping -h localhost -u root"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "30s"
  }
}

resource "docker_container" "shared_mysql_init" {
  memory     = 64
  cpus       = "0.1"
  name       = "shared-mysql-init"
  image      = "mysql:8.0"
  must_run   = false
  restart    = "no"
  attach     = true
  logs       = true
  entrypoint = ["/bin/sh", "-c"]
  command = [
    <<-EOT
      set -eu
      i=0
      until mysql -h ${local.shared_mysql_host} -u root -e 'SELECT 1' >/dev/null 2>&1; do
        i=$((i+1))
        [ "$i" -lt 90 ] || { echo "MySQL not ready" >&2; exit 1; }
        sleep 2
      done
      mysql -h ${local.shared_mysql_host} -u root < /init.sql
      echo "Shared MySQL setup complete"
    EOT
  ]
  env = ["MYSQL_PWD=${var.shared_mysql_root_password}"]
  upload {
    file    = "/init.sql"
    content = local.mysql_init_sql
  }
  networks_advanced { name = "gateway-net" }
  depends_on = [docker_container.shared_mysql]

  lifecycle {
    precondition {
      condition     = alltrue([for a in values(local.mysql_apps) : a.user != "root"])
      error_message = "A MySQL app user is set to 'root'. Use a dedicated user (blog_db_user / doc_db_user)."
    }
    precondition {
      condition = alltrue(flatten([
        for a in values(local.mysql_apps) : concat([can(regex("^[A-Za-z0-9_-]+$", a.user))], [for d in a.dbs : can(regex("^[A-Za-z0-9_-]+$", d))])
      ]))
      error_message = "MySQL user/database names may only contain letters, digits, '_' and '-'."
    }
  }
}

# ---------------------------------------------------------------------------
# MinIO
# ---------------------------------------------------------------------------
resource "docker_container" "shared_minio" {
  # was 256 x 3 instances
  memory  = 384
  cpus    = "0.4"
  name    = local.shared_minio_host
  image   = "quay.io/minio/minio:latest" # pin a tag once you've checked what you're running
  restart = "always"
  command = ["server", "/data", "--console-address", ":9001"]
  env = [
    "MINIO_ROOT_USER=${var.shared_minio_root_user}",
    "MINIO_ROOT_PASSWORD=${var.shared_minio_root_password}",
  ]
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.shared_minio.name
    target = "/data"
    type   = "volume"
  }
  healthcheck {
    test         = ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "20s"
  }
}

resource "docker_container" "shared_minio_init" {
  memory     = 64
  cpus       = "0.1"
  name       = "shared-minio-init"
  image      = "quay.io/minio/mc:latest"
  must_run   = false
  restart    = "no"
  attach     = true
  logs       = true
  entrypoint = ["/bin/sh", "-c"]
  command    = [local.minio_init_script]

  env = concat(
    [
      "MINIO_ROOT_USER=${var.shared_minio_root_user}",
      "MINIO_ROOT_PASSWORD=${var.shared_minio_root_password}",
    ],
    flatten([
      for k, a in local.minio_apps : [
        "APP_${upper(k)}_USER=${a.user}",
        "APP_${upper(k)}_PASS=${a.password}",
      ]
    ])
  )

  dynamic "upload" {
    for_each = local.minio_policies
    content {
      file    = "/policy-${upload.key}.json"
      content = upload.value
    }
  }

  networks_advanced { name = "gateway-net" }
  depends_on = [docker_container.shared_minio]

  lifecycle {
    precondition {
      condition     = alltrue([for a in values(local.minio_apps) : a.user != var.shared_minio_root_user])
      error_message = "An app's *_minio_user equals shared_minio_root_user. MinIO cannot create a user with the root name -- use a different root user."
    }
    precondition {
      condition = alltrue(flatten([
        for a in values(local.minio_apps) : [for b in a.buckets : can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", b))]
      ]))
      error_message = "Invalid bucket name in *_minio_buckets (3-63 chars, lowercase letters, digits, '.' and '-')."
    }
  }
}
