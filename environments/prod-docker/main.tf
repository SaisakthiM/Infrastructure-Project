terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
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

resource "docker_image" "bank_frontend_build" {
  name         = "bank-frontend-build:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Bank Manager/frontend")
    dockerfile = "Dockerfile.prod"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Bank Manager/frontend", "**") :
      filesha256("${var.projects_dir}/Bank Manager/frontend/${f}")
      if !can(regex("(\\.git|node_modules|dist)", f))
    ]))
  }
}

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

resource "docker_image" "hospital_management" {
  name         = "hospital_management:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/hospital_management")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/hospital_management", "**") :
      filesha256("${var.projects_dir}/hospital_management/${f}")
      if !can(regex("(\\.git|__pycache__|\\.pyc|staticfiles|media)", f))
    ]))
  }
}

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

resource "docker_image" "video_backend" {
  name         = "video-uploader-backend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Video Uploader/Main/backend")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Video Uploader/Main/backend", "**") :
      filesha256("${var.projects_dir}/Video Uploader/Main/backend/${f}")
      if !can(regex("(\\.git|__pycache__|\\.pyc)", f))
    ]))
  }
}

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

resource "docker_image" "api_service_backend" {
  name         = "api-service-backend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/API Service/backend")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/API Service/backend", "**") :
      filesha256("${var.projects_dir}/API Service/backend/${f}")
      if !can(regex("(\\.git|__pycache__|\\.pyc)", f))
    ]))
  }
}

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

resource "docker_image" "whisper_frontend" {
  name         = "whisper-frontend:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Whatsapp/whatsapp-frontend")
    dockerfile = "Dockerfile.prod"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Whatsapp/whatsapp-frontend", "**") :
      filesha256("${var.projects_dir}/Whatsapp/whatsapp-frontend/${f}")
      if !can(regex("(\\.git|node_modules|dist)", f))
    ]))
  }
}

resource "docker_container" "notes_postgres" {
  name                  = "notes-postgres"
  image                 = "postgres:16"
  restart               = "always"
  destroy_grace_seconds = 30
  must_run              = true
  env = [
    "POSTGRES_DB=${var.notes_db_name}",
    "POSTGRES_USER=${var.notes_db_user}",
    "POSTGRES_PASSWORD=${var.notes_db_password}",
  ]
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.notes_pgdata.name
    target = "/var/lib/postgresql/data"
    type   = "volume"
  }
}

module "notes_backend" {
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
    "DATABASE_HOST=notes-postgres",
  ]
}

resource "docker_container" "notes_frontend_build" {
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

resource "docker_container" "whisper-postgres" {
  
  name  = "gateway_whisper-pgdata"
  image = "postgres:15-alpine"
  
  env = [
    "POSTGRES_USER=${var.whisper_db_user}",
    "POSTGRES_PASSWORD=${var.whisper_db_password}",
    "POSTGRES_DB=${var.whisper_db_database}"
  ]

  # Map the volume here
  volumes {
    volume_name    = docker_volume.whisper_pgdata.name
    container_path = "/var/lib/postgresql/data"
  }
}

resource "docker_container" "whisper_minio" {
  name  = "whisper-minio"
  image = "minio/minio:latest"
  
  command = ["server", "/data", "--console-address", ":9001"]

  env = [
    "MINIO_ROOT_USER=${var.whisper_minio_user}",
    "MINIO_ROOT_PASSWORD=${var.whisper_minio_password}"
  ]

  # Map the volume here
  volumes {
    volume_name    = docker_volume.whisper_minio_data.name
    container_path = "/data"
  }
}

module "whisper_backend" {
  source        = "../../modules/docker_app"
  name    =  "whisper_backend"
  image = docker_image.whisper_backend.name
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"

  env = [
    "DATABASE_URL=postgresql://${var.whisper_db_user}:${var.whisper_db_password}@gateway_whisper-pgdata:5432/${var.whisper_db_database}",
    "DATABASE_TEST_URL=postgresql://${var.whisper_db_user}:${var.whisper_db_password}@gateway_whisper-pgdata:5432/${var.whisper_db_test_db}",
    "MINIO_USER=${var.whisper_minio_user}",
    "MINIO_PASSWORD=${var.whisper_minio_password}",
    "JWT_SECRET=${var.whisper_jwt_secret}",
    "MINIO_URL=http://whisper-minio:9000",

  ]
  
}

resource "null_resource" "connect_minio" {  

  depends_on = [ docker_container.whisper_minio ]
    provisioner "local-exec" {
      command = <<-EOT
        docker network connect gateway-net whisper-minio
        docker network connect gateway-net gateway_whisper-pgdata 
      EOT
    }
}

resource "docker_container" "whisper_frontend_build" {
  name                  = "whisper-frontend-build"
  image                 = docker_image.whisper_frontend.name
  destroy_grace_seconds = 30
  must_run              = true
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.whisper_dist.name
    target = "/dist"
    type   = "volume"
  }
  env = [
    
  ]
}

resource "docker_container" "bank_postgres" {
  name                  = "bank-postgres"
  image                 = "postgres:16-alpine"
  destroy_grace_seconds = 30
  must_run              = true
  restart               = "always"
  env = [
    "POSTGRES_USER=${var.bank_db_user}",
    "POSTGRES_PASSWORD=${var.bank_db_password}",
    "POSTGRES_DB=${var.bank_db_name}",
  ]
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.bank_pgdata.name
    target = "/var/lib/postgresql/data"
    type   = "volume"
  }
}

module "bank_backend" {
  source        = "../../modules/docker_app"
  name          = "bank-backend"
  image         = docker_image.bank_backend.name
  internal_port = 8080
  external_port = 0
  network       = "gateway-net"
  env = [
    "SPRING_DATASOURCE_URL=jdbc:postgresql://bank-postgres:5432/${var.bank_db_name}",
    "SPRING_DATASOURCE_USERNAME=${var.bank_db_user}",
    "SPRING_DATASOURCE_PASSWORD=${var.bank_db_password}",
    "DB_HOST=bank-postgres",
    "DB_PORT=5432",
    "DB_USER=${var.bank_db_user}",
  ]
}

resource "docker_container" "bank_frontend_build" {
  name                  = "bank-frontend-build"
  image                 = docker_image.bank_frontend_build.name
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

/*
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

 */

module "video_backend" {
  source        = "../../modules/docker_app"
  name          = "video-uploader-backend"
  image         = docker_image.video_backend.name
  internal_port = 8080
  external_port = 0
  network       = "gateway-net"
  env           = ["UPLOADS_DIR=/app/Uploads"]
}

resource "docker_container" "video_frontend_build" {
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
  source        = "../../modules/docker_app"
  name          = "hospital-management"
  image         = docker_image.hospital_management.name
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
}

resource "docker_container" "blog_db" {
  name    = "blog-db"
  image   = "mysql:8.0"
  restart = "always"
  env = [
    "MYSQL_ROOT_PASSWORD=${var.blog_db_password}",
    "MYSQL_DATABASE=${var.blog_db_name}",
  ]
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.blog_mysql.name
    target = "/var/lib/mysql"
    type   = "volume"
  }
  healthcheck {
    test         = ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${var.blog_db_password}"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "30s"
  }
}

resource "docker_container" "blog_minio" {
  name    = "blog-minio"
  image   = "quay.io/minio/minio:latest"
  restart = "always"
  command = ["server", "/data", "--console-address", ":9091"]
  env = [
    "MINIO_ROOT_USER=${var.blog_minio_user}",
    "MINIO_ROOT_PASSWORD=${var.blog_minio_password}",
  ]
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.blog_minio.name
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

resource "docker_container" "blog_minio_init" {
  name       = "blog-minio-init"
  image      = "quay.io/minio/mc:latest"
  must_run   = false
  restart    = "no"
  entrypoint = ["/bin/sh", "-c"]
  command = [
    <<-EOT
      until mc alias set blogminio http://blog-minio:9000 ${var.blog_minio_user} ${var.blog_minio_password}; do
        echo "Waiting for MinIO..."; sleep 2;
      done
      mc mb --ignore-existing blogminio/blog-media
      mc anonymous set download blogminio/blog-media
      echo "Bucket setup complete!"
    EOT
  ]
  networks_advanced { name = "gateway-net" }
  depends_on = [docker_container.blog_minio]
}

module "blog_website" {
  source        = "../../modules/docker_app"
  name          = "blog-website"
  image         = docker_image.blog_website.name
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
  depends_on    = [docker_container.blog_db, docker_container.blog_minio]
  env = [
    "DB_NAME=${var.blog_db_name}",
    "DB_USER=root",
    "DB_PASSWORD=${var.blog_db_password}",
    "DB_HOST=blog-db",
    "DB_PORT=3306",
    "MINIO_ACCESS_KEY=${var.blog_minio_user}",
    "MINIO_SECRET_KEY=${var.blog_minio_password}",
    "MINIO_BUCKET=blog-media",
    "MINIO_ENDPOINT=http://blog-minio:9000",
    "SECRET_KEY=${var.blog_secret_key}",
    "DEBUG=False",
    "ALLOWED_HOSTS=${var.blog_allowed_hosts}",
    "MINIO_PUBLIC_URL=http://localhost/blog/minio",
    "MYSQLCLIENT_LDFLAGS=`pkg-config mysqlclient --libs`",
    "MYSQLCLIENT_CFLAGS=`pkg-config mysqlclient --cflags`",
  ]
}

module "api_service_backend" {
  source        = "../../modules/docker_app"
  name          = "api-service-backend"
  image         = docker_image.api_service_backend.name
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
  env = [
    "API_KEY_WEATHER=${var.api_key_weather}",
  ]
}

resource "docker_container" "api_service_frontend_build" {
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

resource "docker_container" "doc_mysql" {
  name    = "doc-mysql"
  image   = "mysql:8.0"
  restart = "always"
  env = [
    "MYSQL_ROOT_PASSWORD=${var.doc_db_password}",
    "MYSQL_DATABASE=${var.doc_db_name}",
  ]
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.doc_mysql.name
    target = "/var/lib/mysql"
    type   = "volume"
  }
  healthcheck {
    test         = ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${var.doc_db_password}"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "30s"
  }
}

resource "docker_container" "doc_minio" {
  name                  = "doc-minio"
  image                 = "quay.io/minio/minio:latest"
  restart               = "always"
  destroy_grace_seconds = 30
  must_run              = true
  command               = ["server", "/data", "--console-address", ":9001"]
  env = [
    "MINIO_ROOT_USER=${var.doc_minio_user}",
    "MINIO_ROOT_PASSWORD=${var.doc_minio_password}",
  ]
  networks_advanced { name = "gateway-net" }
  mounts {
    source = docker_volume.doc_minio.name
    target = "/data"
    type   = "volume"
  }
}

module "doc_backend" {
  source        = "../../modules/docker_app"
  name          = "doc-backend"
  image         = docker_image.doc_backend.name
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
  env = [
    "DB_HOST=doc-mysql",
    "DB_PORT=3306",
    "DB_NAME=${var.doc_db_name}",
    "DB_USER=root",
    "DB_PASSWORD=${var.doc_db_password}",
    "MINIO_ENDPOINT=doc-minio:9000",
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
}

resource "docker_container" "doc_frontend_build" {
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
