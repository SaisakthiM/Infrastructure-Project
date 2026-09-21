terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 4.4"   # Upgrade from ~> 3.0 to ~> 4.4
    }
    # ...
  }
}

provider "docker" {
  host = var.docker_host
}

# Every resource below joins "gateway-net" by its literal name, not by a
# docker_network.gateway_net resource reference -- that network is owned by
# environments/prod-gateway, a separate Terraform state. Terragrunt enforces
# that prod-gateway applies first (see terragrunt.hcl in this directory) so
# the network actually exists; nothing in here can express that as a real
# Terraform dependency, since the resource doesn't exist in this state.

# ---------------------------------------------------------------------------
# LEGACY data volumes (notes_pgdata, bank_pgdata, whisper_pgdata, blog_mysql,
# doc_mysql, blog_minio, doc_minio, whisper_minio_data): no container mounts
# them any more -- the shared-* instances in shared-data.tf replaced them.
# They are deliberately still declared so `apply` does NOT delete your only
# copy of the old data. Once you've verified the migration (and taken a
# backup), remove the blocks and apply to delete them.
# ---------------------------------------------------------------------------

resource "docker_volume" "notes_dist" { name = "gateway_notes-dist" }

resource "docker_volume" "bank_dist" { name = "gateway_bank-dist" }

resource "docker_volume" "quiz_dist" { name = "gateway_quiz-dist" }

resource "docker_volume" "video_dist" { name = "gateway_video-dist" }

resource "docker_volume" "api_dist" { name = "gateway_api-dist" }

resource "docker_volume" "whisper_dist" { name = "gateway_whisper-dist"}

resource "docker_volume" "notes_pgdata" { name = "gateway_notes-pgdata" }

resource "docker_volume" "notes_static" { name = "gateway_notes-static" }

resource "docker_volume" "notes_media" { name = "gateway_notes-media" }

resource "docker_volume" "bank_pgdata" { name = "gateway_bank-pgdata" }

resource "docker_volume" "doc_mysql" { name = "gateway_doc-mysql" }

resource "docker_volume" "doc_minio" { name = "gateway_doc-minio" }

resource "docker_volume" "doc_dist" { name = "gateway_doc-dist" }

resource "docker_volume" "blog_mysql" { name = "gateway_blog-mysql" }

resource "docker_volume" "blog_minio" { name = "gateway_blog-minio" }

resource "docker_volume" "compiler_db_data" { name = "gateway_compiler-db-data" }

resource "docker_volume" "compiler_server_data" { name = "gateway_compiler-server-data" }

resource "docker_volume" "whisper_pgdata" { name = "gateway_whisper-pgdata"}

resource "docker_volume" "whisper_minio_data" { name = "whisper_minio_data" }

resource "docker_volume" "compiler_dist" { name = "gateway_compiler-dist"}



resource "docker_image" "bank_backend" {
  name         = "bankmanager-backend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Bank Manager/backend/bank_management")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Bank Manager/backend/bank_management", "**") :
      filesha256("${var.projects_dir}/Bank Manager/backend/bank_management/${f}")
      if !can(regex("(\\.git|target|__pycache__|\\.pyc)", f))
    ]))
  }
}

# resource "docker_image" "bank_frontend_build" {
#   name         = "bank-frontend-build:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/Bank Manager/frontend")
#     dockerfile = "Dockerfile.prod"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${var.projects_dir}/Bank Manager/frontend", "**") :
#       filesha256("${var.projects_dir}/Bank Manager/frontend/${f}")
#       if !can(regex("(\\.git|node_modules|dist)", f))
#     ]))
#   }
# }

resource "docker_image" "blog_website" {
  name         = "blogsite:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Blog Website")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Blog Website", "**") :
      filesha256("${var.projects_dir}/Blog Website/${f}")
      if !can(regex("(\\.git|__pycache__|\\.pyc|staticfiles|media)", f))
    ]))
  }
}

# resource "docker_image" "hospital_management" {
#   name         = "hospital_management:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/hospital_management")
#     dockerfile = "Dockerfile"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${var.projects_dir}/hospital_management", "**") :
#       filesha256("${var.projects_dir}/hospital_management/${f}")
#       if !can(regex("(\\.git|__pycache__|\\.pyc|staticfiles|media)", f))
#     ]))
#   }
# }

resource "docker_image" "quiz_frontend_build" {
  name         = "quiz-frontend-build:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Quiz App/quiz-app")
    dockerfile = "Dockerfile.prod"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Quiz App/quiz-app", "**") :
      filesha256("${var.projects_dir}/Quiz App/quiz-app/${f}")
      if !can(regex("(\\.git|node_modules|dist)", f))
    ]))
  }
}

# resource "docker_image" "video_backend" {
#   name         = "video-uploader-backend:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/Video Uploader/Main/backend")
#     dockerfile = "Dockerfile"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${var.projects_dir}/Video Uploader/Main/backend", "**") :
#       filesha256("${var.projects_dir}/Video Uploader/Main/backend/${f}")
#       if !can(regex("(\\.git|__pycache__|\\.pyc)", f))
#     ]))
#   }
# }

resource "docker_image" "video_frontend_build" {
  name         = "video-frontend-build:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Video Uploader/Main/frontend/video-uploader")
    dockerfile = "Dockerfile.prod"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Video Uploader/Main/frontend/video-uploader", "**") :
      filesha256("${var.projects_dir}/Video Uploader/Main/frontend/video-uploader/${f}")
      if !can(regex("(\\.git|node_modules|dist)", f))
    ]))
  }
}

resource "docker_image" "notes_frontend_build" {
  name         = "notes-frontend-build:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Notes App/frontend/notes_app_frontend")
    dockerfile = "Dockerfile.prod"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Notes App/frontend/notes_app_frontend", "**") :
      filesha256("${var.projects_dir}/Notes App/frontend/notes_app_frontend/${f}")
      if !can(regex("(\\.git|node_modules|dist)", f))
    ]))
  }
}

resource "docker_image" "notes_backend" {
  name         = "notesapp-backend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Notes App/backend")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Notes App/backend", "**") :
      filesha256("${var.projects_dir}/Notes App/backend/${f}")
      if !can(regex("(\\.git|__pycache__|\\.pyc)", f))
    ]))
  }
}

# resource "docker_image" "api_service_backend" {
#   name         = "api-service-backend:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/API Service/backend")
#     dockerfile = "Dockerfile"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${trimsuffix(var.projects_dir, "/")}/API Service/backend", "**") :
#       filesha256("${trimsuffix(var.projects_dir, "/")}/API Service/backend/${f}")
#       if !can(regex("(\\.git|__pycache__|\\.pyc)", f))
#     ]))
#   }
# }

resource "docker_image" "api_service_frontend_build" {
  name         = "api-service-frontend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/API Service/frontend/api-service")
    dockerfile = "Dockerfile.prod"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/API Service/frontend/api-service", "**") :
      filesha256("${var.projects_dir}/API Service/frontend/api-service/${f}")
      if !can(regex("(\\.git|node_modules|dist)", f))
    ]))
  }
}

resource "docker_image" "doc_backend" {
  name         = "documentintelligenceplatform-backend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Document Intelligence Platform/backend/document_backend")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Document Intelligence Platform/backend/document_backend", "**") :
      filesha256("${var.projects_dir}/Document Intelligence Platform/backend/document_backend/${f}")
      if !can(regex("(\\.git|__pycache__|\\.pyc)", f))
    ]))
  }
}

resource "docker_image" "doc_frontend_build" {
  name         = "documentintelligenceplatform-frontend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Document Intelligence Platform/frontend/document_frontend")
    dockerfile = "Dockerfile.prod"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Document Intelligence Platform/frontend/document_frontend", "**") :
      filesha256("${var.projects_dir}/Document Intelligence Platform/frontend/document_frontend/${f}")
      if !can(regex("(\\.git|node_modules|dist)", f))
    ]))
  }
}

resource "docker_image" "whisper_backend" {
  name         = "whisper_backend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Whatsapp/whatsapp-backend")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Whatsapp/whatsapp-backend", "**") :
      filesha256("${var.projects_dir}/Whatsapp/whatsapp-backend/${f}")
      if !can(regex("(\\.git|node_modules|dist)", f))
    ]))
  }
}

# resource "docker_image" "whisper_frontend" {
#   name         = "whisper-frontend:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/Whatsapp/whatsapp-frontend")
#     dockerfile = "Dockerfile.prod"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${var.projects_dir}/Whatsapp/whatsapp-frontend", "**") :
#       filesha256("${var.projects_dir}/Whatsapp/whatsapp-frontend/${f}")
#       if !can(regex("(\\.git|node_modules|dist)", f))
#     ]))
#   }
# }

resource "docker_image" "compiler_frontend" {
  name         = "compiler-frontend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Online Compiler/compiler-frontend")
    dockerfile = "Dockerfile.prod"
  }
  
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Online Compiler/compiler-frontend", "**") :
      filesha256("${var.projects_dir}/Online Compiler/compiler-frontend/${f}")
      if !can(regex("(\\.git|node_modules|dist)", f))
    ]))
  }
}

module "notes_backend" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 384
  cpus   = "0.4"
  source        = "../../modules/docker_app"
  name          = "notes-backend"
  image         = docker_image.notes_backend.name
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
  env = [
    "DATABASE_NAME=${var.notes_db_name}",
    "DATABASE_USER=${var.notes_db_user}",
    "DATABASE_PASSWORD=${var.notes_db_password}",
    "DATABASE_HOST=${local.shared_pg_host}",
  ]
  depends_on = [docker_container.shared_postgres_init]
}

resource "docker_container" "notes_frontend_build" {
  # --- resource optimization pass ---
  memory = 128   # MB, hard ceiling
  cpus   = "0.2"
  name                  = "notes-frontend-build"
  image                 = docker_image.notes_frontend_build.name
  destroy_grace_seconds = 30
  must_run              = true
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.notes_dist.name
    target = "/dist"
    type   = "volume"
  }
}

module "whisper_backend" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 384
  cpus   = "0.4"
  source        = "../../modules/docker_app"
  name    =  "whisper_backend"
  image = docker_image.whisper_backend.name
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"

  env = [
    "DATABASE_URL=postgresql://${var.whisper_db_user}:${var.whisper_db_password}@${local.shared_pg_host}:5432/${var.whisper_db_database}",
    "DATABASE_TEST_URL=postgresql://${var.whisper_db_user}:${var.whisper_db_password}@${local.shared_pg_host}:5432/${var.whisper_db_test_db}",
    "MINIO_USER=${var.whisper_minio_user}",
    "MINIO_PASSWORD=${var.whisper_minio_password}",
    "JWT_SECRET=${var.whisper_jwt_secret}",
    "MINIO_URL=http://${local.shared_minio_host}:9000",
  ]

  depends_on = [
    docker_container.shared_postgres_init,
    docker_container.shared_minio_init,
  ]
}

resource "docker_container" "whisper_frontend_build" {
  # --- resource optimization pass ---
  memory = 128   # MB, hard ceiling
  cpus   = "0.2"
  name                  = "whisper-frontend-build"
  image                 = "whisper-frontend:latest"
  depends_on = [null_resource.whisper_frontend_image]
  destroy_grace_seconds = 30
  must_run              = true
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.whisper_dist.name
    target = "/dist"
    type   = "volume"
  }
  env = [
    "VITE_API_URL=${var.whisper_domain}"
  ]
}

module "bank_backend" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 1024
  cpus   = "1.0"
  source        = "../../modules/docker_app"
  name          = "bank-backend"
  image         = docker_image.bank_backend.name
  internal_port = 8080
  external_port = 0
  network       = "gateway-net"
  env = [
    "SPRING_DATASOURCE_URL=jdbc:postgresql://${local.shared_pg_host}:5432/${var.bank_db_name}",
    "SPRING_DATASOURCE_USERNAME=${var.bank_db_user}",
    "SPRING_DATASOURCE_PASSWORD=${var.bank_db_password}",
    "DB_HOST=${local.shared_pg_host}",
    "DB_PORT=5432",
    "DB_USER=${var.bank_db_user}",
  ]
  depends_on = [docker_container.shared_postgres_init]
}

resource "docker_container" "bank_frontend_build" {
  # --- resource optimization pass ---
  memory = 128   # MB, hard ceiling
  cpus   = "0.2"
  name                  = "bank-frontend-build"
  image                 = "bank-frontend-build:latest"
  depends_on = [null_resource.bank_frontend_build_image]
  destroy_grace_seconds = 30
  must_run              = true
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.bank_dist.name
    target = "/dist"
    type   = "volume"
  }
}

resource "docker_container" "quiz_frontend_build" {
  # --- resource optimization pass ---
  memory = 128   # MB, hard ceiling
  cpus   = "0.2"
  name                  = "quiz-frontend-build"
  image                 = docker_image.quiz_frontend_build.name
  destroy_grace_seconds = 30
  must_run              = true
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.quiz_dist.name
    target = "/dist"
    type   = "volume"
  }
}


resource "docker_image" "compiler_db" {
  name         = "online_compiler_db:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Online Compiler/database_new")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Online Compiler/database_new", "**") :
      filesha256("${var.projects_dir}/Online Compiler/database_new/${f}")
      if !can(regex("(\\.git|\\.dockerignore|dbserver|\\.o|data/)", f))
    ]))
  }
}

resource "docker_image" "compiler_server" {
  name         = "online_compiler_server:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Online Compiler/server_new")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Online Compiler/server_new", "**") :
      filesha256("${var.projects_dir}/Online Compiler/server_new/${f}")
      if !can(regex("(\\.git|\\.dockerignore|^server$|\\.o|users\\.db)", f))
    ]))
  }
}

resource "docker_container" "compiler_db" {
  # --- resource optimization pass ---
  memory = 256   # MB, hard ceiling
  cpus   = "0.3"
  name                  = "compiler-db"
  image                 = docker_image.compiler_db.image_id
  restart               = "unless-stopped"
  destroy_grace_seconds = 30
  must_run              = true

  networks_advanced { name = "gateway-net" }

  mounts {
    source = docker_volume.compiler_db_data.name
    target = "/app/data"
    type   = "volume"
  }

  # Not exposed externally — only the auth server talks to it
  # over the gateway-net by container name "compiler-db"

  healthcheck {
    test         = ["CMD-SHELL", "curl -sf 'http://localhost:8080/search?database_name=x&table_name=y&id=1' || exit 0"]
    interval     = "5s"
    timeout      = "3s"
    retries      = 5
    start_period = "5s"
  }
}

module "compiler_server" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 512
  cpus   = "0.5"
  source        = "../../modules/docker_app"
  name          = "compiler-server"
  image         = docker_image.compiler_server.image_id
  internal_port = 9090
  external_port = 0          # nginx proxies it — not exposed directly
  network       = "gateway-net"

  env = [
    "DB_HOST=compiler-db",   # container name on gateway-net
    "DB_PORT=8080",
  ]

  depends_on = [docker_container.compiler_db]
}

resource "docker_container" "compiler_frontend_build" {
  # --- resource optimization pass ---
  memory = 128   # MB, hard ceiling
  cpus   = "0.2"
  name                  = "compiler-frontend-build"
  image                 = docker_image.compiler_frontend.name
  destroy_grace_seconds = 30
  must_run              = true
  networks_advanced { name = "gateway-net" }
  env = [
    "VITE_API_URL=${var.compiler_domain}"
  ]
  mounts {
    source = docker_volume.compiler_dist.name
    target = "/dist"
    type   = "volume"
  }
}



module "video_backend" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 512
  cpus   = "0.5"
  source        = "../../modules/docker_app"
  name          = "video-uploader-backend"
  image         = "video-uploader-backend:latest"
  depends_on = [null_resource.video_backend_image]
  internal_port = 8080
  external_port = 0
  network       = "gateway-net"
  env           = ["UPLOADS_DIR=/app/Uploads"]
}

resource "docker_container" "video_frontend_build" {
  # --- resource optimization pass ---
  memory = 128   # MB, hard ceiling
  cpus   = "0.2"
  name                  = "video-frontend-build"
  image                 = docker_image.video_frontend_build.name
  destroy_grace_seconds = 30
  must_run              = true
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.video_dist.name
    target = "/dist"
    type   = "volume"
  }
}

module "hospital_management" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 512
  cpus   = "0.5"
  source        = "../../modules/docker_app"
  name          = "hospital-management"
  image         = "hospital_management:latest"
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
}

module "blog_website" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 512
  cpus   = "0.5"
  source        = "../../modules/docker_app"
  name          = "blog-website"
  image         = docker_image.blog_website.name
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
  depends_on = [
    docker_container.shared_mysql_init,
    docker_container.shared_minio_init,
  ]
  env = [
    "DB_NAME=${var.blog_db_name}",
    "DB_USER=${var.blog_db_user}",
    "DB_PASSWORD=${var.blog_db_password}",
    "DB_HOST=${local.shared_mysql_host}",
    "DB_PORT=3306",
    "MINIO_ACCESS_KEY=${var.blog_minio_user}",
    "MINIO_SECRET_KEY=${var.blog_minio_password}",
    "MINIO_BUCKET=blog-media",
    "MINIO_ENDPOINT=http://${local.shared_minio_host}:9000",
    "SECRET_KEY=${var.blog_secret_key}",
    "DEBUG=False",
    "ALLOWED_HOSTS=${var.blog_allowed_hosts}",
    "MINIO_PUBLIC_URL=http://localhost/blog/minio",
    "MYSQLCLIENT_LDFLAGS=`pkg-config mysqlclient --libs`",
    "MYSQLCLIENT_CFLAGS=`pkg-config mysqlclient --cflags`",
  ]
}

module "api_service_backend" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 256
  cpus   = "0.3"
  source        = "../../modules/docker_app"
  name          = "api-service-backend"
  image         = "api-service-backend:latest"
  depends_on = [null_resource.api_service_backend_image]
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
  env = [
    "API_KEY_WEATHER=${var.api_key_weather}",
  ]
}

resource "docker_container" "api_service_frontend_build" {
  # --- resource optimization pass ---
  memory = 128   # MB, hard ceiling
  cpus   = "0.2"
  name                  = "api-service-frontend-build"
  image                 = docker_image.api_service_frontend_build.name
  must_run              = false
  restart               = "no"
  destroy_grace_seconds = 30
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.api_dist.name
    target = "/dist"
    type   = "volume"
  }
}

module "doc_backend" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 768
  cpus   = "0.6"
  source        = "../../modules/docker_app"
  name          = "doc-backend"
  image         = docker_image.doc_backend.name
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
  env = [
    "DB_HOST=${local.shared_mysql_host}",
    "DB_PORT=3306",
    "DB_NAME=${var.doc_db_name}",
    "DB_USER=${var.doc_db_user}",
    "DB_PASSWORD=${var.doc_db_password}",
    "MINIO_ENDPOINT=${local.shared_minio_host}:9000",
    "MINIO_ACCESS_KEY=${var.doc_minio_user}",
    "MINIO_SECRET_KEY=${var.doc_minio_password}",
    "MINIO_BUCKET=documents",
    "MINIO_SECURE=False",
    "GEMINI_API_KEY=${var.doc_gemini_api_key}",
    "OLLAMA_HOST=host.docker.internal",
    "PORT_AI=11434",
    "DJANGO_SECRET_KEY=${var.doc_django_secret_key}",
    "DEBUG=False",
    "ALLOWED_HOSTS=localhost,127.0.0.1,gateway,doc-backend",
  ]
  depends_on = [
    docker_container.shared_mysql_init,
    docker_container.shared_minio_init,
  ]
}

resource "docker_container" "doc_frontend_build" {
  # --- resource optimization pass ---
  memory = 128   # MB, hard ceiling
  cpus   = "0.2"
  name                  = "doc-frontend-build"
  image                 = docker_image.doc_frontend_build.name
  must_run              = false
  restart               = "no"
  destroy_grace_seconds = 30
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.doc_dist.name
    target = "/output"
    type   = "volume"
  }
}




# ---------------------------------------------------------------------------
# Selenium (Chrome grid) for local test runs -- built from the compose at
# ${var.projects_dir}/Selenium (services: "selenium" = selenium/standalone-chrome,
# "java" = the test runner built from Selenium/java/selenium/Dockerfile).
#
# Capped at 8 cores / 12GB combined so your own Chrome + VS Code still have
# headroom on the host -- see the resource-optimization thread. shm_size
# mirrors the compose file's `shm_size: 2gb`; Chrome needs real /dev/shm or
# it crashes mid-session under any real load.
# ---------------------------------------------------------------------------
resource "docker_volume" "selenium_chrome_profiles" {
  # Declared in the source docker-compose.yml (top-level `volumes:
  # chrome_profiles`) but not actually mounted by either service there --
  # kept here 1:1 with the compose for now. Add a `volumes { }` block below
  # if you start mounting it.
  name = "selenium_chrome-profiles"
}

resource "docker_image" "selenium_chrome" {
  name         = "selenium/standalone-chrome:latest"
  keep_locally = true
}

resource "docker_container" "selenium_chrome" {
  name    = "selenium"
  image   = docker_image.selenium_chrome.image_id
  restart = "unless-stopped"

  env = [
    "SE_NODE_MAX_SESSIONS=2",
    "SE_NODE_OVERRIDE_MAX_SESSIONS=true",
  ]

  # Chrome/webdriver is the heavy half of the 8-core/12GB budget.
  memory   = 8192   # MB
  cpus     = "6"
  shm_size = 2048   # MB == compose's `shm_size: 2gb`

  ports {
    internal = 4444
    external = 4444
  }
  ports {
    internal = 7900   # noVNC -- drop this block if you don't need to watch it run
    external = 7900
  }

  networks_advanced { name = "gateway-net" }
}

resource "docker_image" "selenium_java" {
  name         = "selenium-java-runner:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Selenium/java/selenium")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Selenium/java/selenium", "**") :
      filesha256("${var.projects_dir}/Selenium/java/selenium/${f}")
      if !can(regex("(\\.git|target|__pycache__)", f))
    ]))
  }
}

resource "docker_container" "selenium_java" {
  name     = "selenium-java-runner"
  image    = docker_image.selenium_java.image_id
  must_run = true
  restart  = "unless-stopped"

  memory = 4096
  cpus   = "2"

  env = [
    "JAVA_OPTS=-XX:MaxRAMPercentage=50.0 -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:+DisableExplicitGC",
    "SE_JAVA_OPTS=-XX:MaxRAMPercentage=50.0 -XX:+UseG1GC -XX:MaxGCPauseMillis=100",
  ]

  networks_advanced { name = "gateway-net" }
  depends_on = [docker_container.selenium_chrome]
}

# ---------------------------------------------------------------------------
# Converted from docker_image.api_service_backend — provider build-context bug workaround.
# ---------------------------------------------------------------------------
resource "null_resource" "api_service_backend_image" {
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${trimsuffix(var.projects_dir, "/")}/API Service/backend", "**") :
      filesha256("${trimsuffix(var.projects_dir, "/")}/API Service/backend/${f}")
      if !can(regex("(^|/)(node_modules|\\.git|\\.next|__pycache__|\\.venv|target)/", f))
    ]))
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      IMAGE="api-service-backend:latest"
      BUILD_DIR="${trimsuffix(var.projects_dir, "/")}/API Service/backend"

      if docker image inspect "$IMAGE" >/dev/null 2>&1; then
        echo "Image $IMAGE already exists, skipping build."
        exit 0
      fi

      echo "Building $IMAGE from $BUILD_DIR ..."
      cd "$BUILD_DIR"
      docker build -t "$IMAGE" .
      echo "Build complete."
    EOT
  }
}

# ---------------------------------------------------------------------------
# Converted from docker_image.bank_frontend_build — provider build-context bug workaround.
# ---------------------------------------------------------------------------
resource "null_resource" "bank_frontend_build_image" {
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${trimsuffix(var.projects_dir, "/")}/Bank Manager/frontend", "**") :
      filesha256("${trimsuffix(var.projects_dir, "/")}/Bank Manager/frontend/${f}")
      if !can(regex("(^|/)(node_modules|\\.git|\\.next|__pycache__|\\.venv|target)/", f))
    ]))
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      IMAGE="bank-frontend-build:latest"
      BUILD_DIR="${trimsuffix(var.projects_dir, "/")}/Bank Manager/frontend"

      if docker image inspect "$IMAGE" >/dev/null 2>&1; then
        echo "Image $IMAGE already exists, skipping build."
        exit 0
      fi

      echo "Building $IMAGE from $BUILD_DIR ..."
      cd "$BUILD_DIR"
      docker build -t "$IMAGE" .
      echo "Build complete."
    EOT
  }
}

# ---------------------------------------------------------------------------
# Converted from docker_image.video_backend — provider build-context bug workaround.
# ---------------------------------------------------------------------------
resource "null_resource" "video_backend_image" {
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${trimsuffix(var.projects_dir, "/")}/Video Uploader/Main/backend", "**") :
      filesha256("${trimsuffix(var.projects_dir, "/")}/Video Uploader/Main/backend/${f}")
      if !can(regex("(^|/)(node_modules|\\.git|\\.next|__pycache__|\\.venv|target)/", f))
    ]))
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      IMAGE="video-uploader-backend:latest"
      BUILD_DIR="${trimsuffix(var.projects_dir, "/")}/Video Uploader/Main/backend"

      if docker image inspect "$IMAGE" >/dev/null 2>&1; then
        echo "Image $IMAGE already exists, skipping build."
        exit 0
      fi

      echo "Building $IMAGE from $BUILD_DIR ..."
      cd "$BUILD_DIR"
      docker build -t "$IMAGE" .
      echo "Build complete."
    EOT
  }
}

# ---------------------------------------------------------------------------
# Converted from docker_image.whisper_frontend — provider build-context bug workaround.
# ---------------------------------------------------------------------------
resource "null_resource" "whisper_frontend_image" {
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${trimsuffix(var.projects_dir, "/")}/Whatsapp/whatsapp-frontend", "**") :
      filesha256("${trimsuffix(var.projects_dir, "/")}/Whatsapp/whatsapp-frontend/${f}")
      if !can(regex("(^|/)(node_modules|\\.git|\\.next|__pycache__|\\.venv|target)/", f))
    ]))
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      IMAGE="whisper-frontend:latest"
      BUILD_DIR="${trimsuffix(var.projects_dir, "/")}/Whatsapp/whatsapp-frontend"

      if docker image inspect "$IMAGE" >/dev/null 2>&1; then
        echo "Image $IMAGE already exists, skipping build."
        exit 0
      fi

      echo "Building $IMAGE from $BUILD_DIR ..."
      cd "$BUILD_DIR"
      docker build -t "$IMAGE" -f Dockerfile.prod .
      echo "Build complete."
    EOT
  }
}

# ---------------------------------------------------------------------------
# Converted from docker_image.hospital_management.
# ---------------------------------------------------------------------------
resource "null_resource" "hospital_management_image" {
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${trimsuffix(var.projects_dir, "/")}/hospital_management", "**") :
      filesha256("${trimsuffix(var.projects_dir, "/")}/hospital_management/${f}")
      if !can(regex("(^|/)(node_modules|\\.git|\\.next|__pycache__|\\.venv|target)/", f))
    ]))
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      IMAGE="hospital_management:latest"
      BUILD_DIR="${trimsuffix(var.projects_dir, "/")}/hospital_management"

      if docker image inspect "$IMAGE" >/dev/null 2>&1; then
        echo "Image $IMAGE already exists, skipping build."
        exit 0
      fi

      echo "Building $IMAGE from $BUILD_DIR ..."
      cd "$BUILD_DIR"
      docker build -t "$IMAGE" .
      echo "Build complete."
    EOT
  }
}
