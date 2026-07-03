terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    kubectl = {
      source = "gavinbunney/kubectl"
    }
  }
}



provider "docker" {
  host = var.docker_host
}

provider "kubectl" {
  config_path    = "~/.kube/config"
  config_context = "kind-social-media"
}

locals {
  # Still needed for otel-gateway-config.yml's bind mount below. Everything
  # else that used to read from this path (prometheus.yml, grafana-values.yml,
  # loki-config.yml, etc.) is now referenced directly from git by the ArgoCD
  # Applications in gitops/observability/apps/, not read by Terraform.
  obs_path = "${var.projects_dir}/platform/observability"
}

# ---------------------------------------------------------------------------
# Docker-side OTEL bridge: forwards from gateway-net into the kind cluster's
# NodePort collector. Both networks are joined by literal name -- "gateway-net"
# is owned by prod-gateway, "kind" is created by the kind tool itself when
# prod-social's null_resource.kind_cluster runs, neither is a resource this
# state can reference directly.
# ---------------------------------------------------------------------------
resource "docker_image" "otel_gateway" {
  name         = "otel/opentelemetry-collector-contrib:0.100.0"
  keep_locally = true
}

resource "docker_container" "otel_gateway" {
  name    = "otel-gateway"
  image   = docker_image.otel_gateway.image_id
  restart = "unless-stopped"

  ports {
    internal = 4317
    external = 4317
  }
  ports {
    internal = 4318
    external = 4318
  }
  ports {
    internal = 13133
    external = 13133
  }

  mounts {
    type      = "bind"
    source    = abspath("${local.obs_path}/otel-gateway-config.yml")
    target    = "/etc/otelcol-contrib/config.yaml"
    read_only = true
  }

  command = ["--config=/etc/otelcol-contrib/config.yaml"]

  networks_advanced {
    name = "gateway-net"
  }
  networks_advanced {
    name = "kind"
  }

  healthcheck {
    test         = ["CMD", "wget", "--spider", "-q", "http://localhost:13133/"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "10s"
  }

  # Originally depended on kubectl_manifest.otel_nodeport, which now lives as
  # a gitops-synced manifest (gitops/observability/raw/01-otel-nodeport.yaml)
  # with no Terraform handle in this state. If this container starts before
  # ArgoCD has synced that NodePort Service, its OTLP exports just fail/retry
  # until the Service exists -- the collector buffers and retries by design,
  # so this is a startup-ordering inconvenience, not data loss, but it's a
  # real loosening from the original strict depends_on. Terragrunt's
  # "dependencies" on prod-social gets you close (ArgoCD will already be
  # running), just not a guarantee that this specific Service has synced yet.
}

module "node_exporter" {
  source        = "../../modules/docker_app"
  name          = "node-exporter"
  image         = "prom/node-exporter:latest"
  internal_port = 9100
  external_port = 9100
  network       = "gateway-net"

  volumes = [
    { host_path = "/proc", container_path = "/host/proc", read_only = true },
    { host_path = "/sys", container_path = "/host/sys", read_only = true },
    { host_path = "/", container_path = "/rootfs", read_only = true },
  ]

  command = [
    "--path.procfs=/host/proc",
    "--path.rootfs=/rootfs",
    "--path.sysfs=/host/sys",
    "--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)",
  ]
}

# ---------------------------------------------------------------------------
# n8n
# ---------------------------------------------------------------------------
resource "docker_volume" "n8n_data" {
  name = "gateway_n8n-data"
}

resource "docker_container" "n8n" {
  name  = "n8n"
  image = "n8nio/n8n:latest"
  # depends_on = [module.gateway] removed -- module.gateway lives in
  # prod-gateway now, a separate state. n8n just needs "gateway-net" to
  # already exist, which terragrunt's "dependencies" block on prod-gateway
  # guarantees at apply time.

  env = [for k, v in var.n8n_env : "${k}=${v}"]

  mounts {
    source = docker_volume.n8n_data.name
    target = "/home/node/.n8n"
    type   = "volume"
  }

  networks_advanced {
    name = "gateway-net"
  }
}

# ---------------------------------------------------------------------------
# Jenkins + agent
# ---------------------------------------------------------------------------
resource "docker_volume" "jenkins_home" { name = "jenkins_home" }

resource "docker_image" "jenkins" {
  name         = "jenkins/jenkins:lts"
  keep_locally = true
}

resource "docker_container" "jenkins" {
  name    = "jenkins"
  image   = docker_image.jenkins.image_id
  restart = "unless-stopped"

  env = [
    "JENKINS_OPTS=--prefix=/jenkins",
    "JAVA_OPTS=-Djava.awt.headless=true -Dhudson.security.csrf.GlobalCrumbIssuerConfiguration.DISABLE_CSRF_PROTECTION=true"
    ]

  ports {
    internal = 8080
    external = 8090
  }
  ports {
    internal = 50000
    external = 50000
  }

  volumes {
    volume_name    = docker_volume.jenkins_home.name
    container_path = "/var/jenkins_home"
  }
  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
  }

  networks_advanced {
    name = "gateway-net"
  }
}

resource "docker_image" "jenkins_agent" {
  name         = "jenkins/inbound-agent:latest"
  keep_locally = true
}

resource "docker_container" "jenkins_agent" {
  name    = "jenkins-agent"
  image   = docker_image.jenkins_agent.image_id
  restart = "unless-stopped"

  env = [
    "JENKINS_URL=http://jenkins:8080/jenkins/",
    "JENKINS_AGENT_NAME=Worker",
    "JENKINS_SECRET=af8a382676b767a8d8a33aaf1824256892d08a8f1fb6ff98ec0070fbbf689c66",
    "JENKINS_AGENT_WORKDIR=/home/jenkins/agent",
  ]

  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
  }

  networks_advanced {
    name = "gateway-net"
  }
  volumes {
    host_path      = abspath("${path.module}/variable.tf")
    container_path = "/etc/terraform/terraform.tfvars"
  }

  provisioner "local-exec" {
    command = <<-EOT
      sleep 5
      docker exec --user root jenkins-agent bash -c "
        apt-get update -qq &&
        apt-get install -y docker.io wget unzip &&
        chmod 666 /var/run/docker.sock &&
        wget -q https://releases.hashicorp.com/terraform/1.9.0/terraform_1.9.0_linux_amd64.zip &&
        unzip terraform_1.9.0_linux_amd64.zip &&
        mv terraform /usr/local/bin/ &&
        rm terraform_1.9.0_linux_amd64.zip &&
        chown -R jenkins:jenkins /home/jenkins &&
        echo 'Done!'
      "
    EOT
  }

  depends_on = [docker_container.jenkins]
}

# ---------------------------------------------------------------------------
# Atlantis -- PR-gated terraform/terragrunt plan+apply.
#
# Has to run on this same box: it needs the literal docker socket path
# prod-gateway/prod-docker's "docker" provider hardcodes
# (/home/saisakthi/.docker/desktop/docker.sock), and ~/.kube/config with the
# kind-social-media context that prod-social/prod-infra's kubectl/helm/
# kubernetes providers read. Neither is reachable from a remote runner.
#
# BOOTSTRAP NOTE: this block itself has to go through one manual
# `terragrunt apply` from your terminal before Atlantis exists to apply
# anything -- same chicken-and-egg as helm_release.argocd in prod-social.
# Every prod-infra change AFTER that first apply can go through a PR.
# ---------------------------------------------------------------------------
resource "docker_volume" "atlantis_data" { name = "gateway_atlantis-data" }

resource "docker_image" "atlantis" {
  name         = "atlantis-terragrunt:latest"
  keep_locally = true
  build {
    context    = abspath("${path.module}/atlantis")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${path.module}/atlantis", "**") :
      filesha256("${path.module}/atlantis/${f}")
    ]))
  }
}

resource "null_resource" "atlantis_ssh_key" {
  triggers = {
    always = timestamp()
  }

  provisioner "local-exec" {
    command = <<-EOT
      mkdir -p /home/saisakthi/.atlantis-ssh
      chmod 700 /home/saisakthi/.atlantis-ssh

      # generate key if it doesn't already exist
      if [ ! -f /home/saisakthi/.atlantis-ssh/id_ed25519 ]; then
        ssh-keygen -t ed25519 -f /home/saisakthi/.atlantis-ssh/id_ed25519 -N "" -C "atlantis@docker"
      fi

      chmod 600 /home/saisakthi/.atlantis-ssh/id_ed25519
      chmod 644 /home/saisakthi/.atlantis-ssh/id_ed25519.pub

      # add to authorized_keys if not already present
      PUBKEY=$(cat /home/saisakthi/.atlantis-ssh/id_ed25519.pub)
      if ! grep -qF "$PUBKEY" /home/saisakthi/.ssh/authorized_keys 2>/dev/null; then
        echo "$PUBKEY" >> /home/saisakthi/.ssh/authorized_keys
        chmod 600 /home/saisakthi/.ssh/authorized_keys
      fi
    EOT
  }
}

resource "docker_container" "atlantis" {
  name    = "atlantis"
  image   = docker_image.atlantis.image_id
  restart = "unless-stopped"
  depends_on = [null_resource.atlantis_ssh_key]

  # Has to be root (or a uid that can read them) to use the bind-mounted
  # docker.sock and ~/.kube/config below -- same tradeoff jenkins_agent
  # already makes for its own docker.sock mount above.
  user = "0:0"

  env = [
    "ATLANTIS_GH_USER=${var.atlantis_gh_user}",
    "ATLANTIS_GH_TOKEN=${var.atlantis_gh_token}",
    "ATLANTIS_GH_WEBHOOK_SECRET=${var.atlantis_gh_webhook_secret}",
    "ATLANTIS_REPO_ALLOWLIST=${var.gitops_repo_url}",
    "ATLANTIS_PORT=4141",
    "ATLANTIS_ATLANTIS_URL=https://${var.domain}/atlantis",
    "ATLANTIS_DATA_DIR=/atlantis-data",
    "ATLANTIS_REPO_CONFIG=/etc/atlantis/repos.yaml",
    # "~" in prod-social/prod-infra's provider config_path blocks resolves
    # against this -- has to match where the kubeconfig volume below lands.
    "HOME=/home/saisakthi",
  ]

  volumes {
    volume_name    = docker_volume.atlantis_data.name
    container_path = "/atlantis-data"
  }
  volumes {
    host_path      = abspath("${path.module}/atlantis/repos.yaml")
    container_path = "/etc/atlantis/repos.yaml"
    read_only      = true
  }

  volumes {
    host_path      = "/home/saisakthi/.atlantis-ssh"
    container_path = "/root/.ssh"
    read_only      = true
  }
  # Identical absolute path inside the container as the host, on purpose --
  # the "docker" provider's host = "unix:///home/saisakthi/..." string gets
  # evaluated wherever Terraform itself is running, i.e. inside THIS
  # container once Atlantis applies anything. It has to find a real socket
  # at that exact path.
  volumes {
    host_path      = "/var/run/docker.sock"   # ← this, not the Desktop socket path
    container_path = "/var/run/docker.sock"
    read_only      = false
  }
  # Same idea for the kind-social-media kubeconfig context.
  volumes {
    host_path      = "/home/saisakthi/.kube"
    container_path = "/home/saisakthi/.kube"
  }

  networks_advanced {
    name = "gateway-net"
  }
}

# ---------------------------------------------------------------------------
# Credential kept out of git, referenced by gitops/observability/apps/
# observability-redis-app.yaml via auth.existingSecret.
# ---------------------------------------------------------------------------
resource "kubectl_manifest" "redis_auth_secret" {
  yaml_body = <<-YAML
    apiVersion: v1
    kind: Secret
    metadata:
      name: redis-auth-secret
    type: Opaque
    data:
      REDIS_PASSWORD: ${base64encode(var.observability_redis_password)}
  YAML
}

# ---------------------------------------------------------------------------
# The single Terraform handle into GitOps for this environment. Requires
# ArgoCD (installed by prod-social) to already exist -- enforced via
# terragrunt "dependencies", not a real Terraform output read.
# ---------------------------------------------------------------------------
resource "kubectl_manifest" "app_of_apps_observability" {
  depends_on = [kubectl_manifest.redis_auth_secret]
  yaml_body  = <<-YAML
    apiVersion: argoproj.io/v1alpha1
    kind: Application
    metadata:
      name: observability-app-of-apps
      namespace: argocd
    spec:
      project: default
      source:
        repoURL: ${var.gitops_repo_url}
        targetRevision: HEAD
        path: gitops/observability/apps
        directory:
          recurse: false
      destination:
        server: https://kubernetes.default.svc
        namespace: argocd
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
  YAML
}
