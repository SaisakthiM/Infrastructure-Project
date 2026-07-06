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

# ---------------------------------------------------------------------------
# Foundation network. Every other environment joins this network by the
# literal string "gateway-net" -- never by a resource/module reference --
# because they live in separate Terraform state. This is the one and only
# environment that creates it, and it has zero dependencies of its own.
# ---------------------------------------------------------------------------
module "network" {
  source = "../../modules/networking"
  name   = "gateway-net"
}

# ---------------------------------------------------------------------------
# Static content volumes that are entirely local to gateway: nobody else
# produces or reads "intro" / "record" content, so unlike notes_dist,
# bank_dist, etc. (owned by prod-docker) these stay right here next to the
# null_resources that populate them and the module that mounts them.
# ---------------------------------------------------------------------------
resource "docker_volume" "intro_dist" { name = "gateway_intro-dist" }
resource "docker_volume" "record_dist" { name = "gateway_record-dist" }

module "gateway" {
  source        = "../../modules/docker_app"
  name          = "gateway"
  image         = "nginx:alpine"
  internal_port = 80
  external_port = 80
  network       = module.network.network_name

  volumes = [
    {
      host_path      = abspath("${path.module}/nginx/default.conf")
      container_path = "/etc/nginx/conf.d/default.conf"
      read_only      = true
    },
    {
      host_path      = "/home/saisakthi/cloudflare/"
      container_path = "/etc/cloudflare/"
      read_only      = true
    },
  ]

  # These volume_name values are PLAIN STRINGS, not docker_volume.X.name
  # resource references, on purpose -- notes_dist/bank_dist/quiz_dist/
  # video_dist/api_dist/doc_dist/whisper_dist are all owned and populated by
  # environments/prod-docker, a completely separate Terraform state. Docker
  # volumes are identified by name at the daemon level, not by which
  # Terraform state created them, so this mount picks up whatever real
  # content prod-docker has already written into that name -- gateway just
  # can't have a hard `depends_on` across the state boundary.
  #
  # Apply-order requirement (enforced by Terragrunt, not by this file):
  # run prod-docker at least once before you expect real content here. If
  # gateway starts first on a brand-new host, Docker auto-creates an empty
  # volume with that name and nginx will serve empty directories until
  # prod-docker's build containers populate it -- no restart needed once
  # they do, since it's a live filesystem mount.
  named_volumes = [
    { volume_name = "gateway_notes-dist", container_path = "/apps/notes", read_only = true },
    { volume_name = "gateway_bank-dist", container_path = "/apps/bank", read_only = true },
    { volume_name = "gateway_quiz-dist", container_path = "/apps/quiz", read_only = true },
    { volume_name = "gateway_video-dist", container_path = "/apps/video", read_only = true },
    { volume_name = "gateway_api-dist", container_path = "/apps/api-service", read_only = true },
    { volume_name = "gateway_doc-dist", container_path = "/apps/document", read_only = true },
    { volume_name = docker_volume.intro_dist.name, container_path = "/apps/intro", read_only = true },
    { volume_name = docker_volume.record_dist.name, container_path = "/apps/record", read_only = true },
    { volume_name = "gateway_whisper-dist", container_path = "/apps/whisper", read_only = true },
    { volume_name = "gateway_compiler-dist", container_path = "/apps/compiler", read_only = true },

  ]
}

# Same-state depends_on, untouched -- gateway and these null_resources live
# together here, so nothing changes about how they relate to each other.
resource "null_resource" "intro_page" {
  depends_on = [module.gateway]

  triggers = {
    file_sha   = filesha256("${var.projects_dir}/intro/index.html")
    always_run = timestamp()
  }
  provisioner "local-exec" {
    command = <<-EOT
      docker pull alpine && \
      docker run --rm \
        -v gateway_intro-dist:/dest \
        -v "${abspath("${var.projects_dir}/intro")}:/src:ro" \
        alpine sh -c "cp -r /src/. /dest/"
    EOT
  }
}

resource "null_resource" "record_page" {
  depends_on = [module.gateway]

  triggers = {
    file_sha   = filesha256("${var.projects_dir}/security_tests/record.html")
    always_run = timestamp()
  }
  provisioner "local-exec" {
    command = <<-EOT
      docker pull alpine && \
      docker run --rm \
        -v gateway_record-dist:/dest \
        -v "${abspath("${var.projects_dir}/security_tests")}:/src:ro" \
        alpine sh -c "cp -r /src/. /dest/"
    EOT
  }
}

module "nginx_exporter" {
  source        = "../../modules/docker_app"
  name          = "nginx-exporter"
  image         = "nginx/nginx-prometheus-exporter:latest"
  internal_port = 9113
  external_port = 9113
  network       = module.network.network_name

  command = [
    "--nginx.scrape-uri=http://gateway:8080/nginx_status",
  ]

  depends_on = [module.gateway]
}
# atlantis test
