terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 4.4"
    }
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.19"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
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
# Ordering gate: prod-infra owns nothing that creates the kind cluster or
# ArgoCD -- both come from prod-social -- yet every Kubernetes-side resource
# here needs them already running:
#
#   docker_container.otel_gateway  joins the "kind" docker network by literal
#     name. No cluster -> "network kind not found" and the apply dies.
#   kubectl_manifest.app_of_apps_observability is an argoproj.io/v1alpha1
#     Application written into namespace argocd. No CRD -> "no kind is
#     registered for the type v1alpha1 Application"; no namespace -> "not
#     found". This is the "argocd not found" class of failure.
#
# Terragrunt's `dependencies` already puts prod-social first during
# `run --all apply`, but a standalone `terragrunt apply` in this folder (or a
# prod-social apply that installed ArgoCD seconds ago and hasn't reconciled)
# has no such guarantee. This gate turns a confusing "not found" into a plain
# instruction. Triggers are deliberately stable, not timestamp(): a fresh
# state runs it once, and re-running it after the cluster is recreated
# outside Terraform is `-replace=null_resource.prod_social_ready`.
# ---------------------------------------------------------------------------
resource "null_resource" "prod_social_ready" {
  triggers = {
    context = "kind-social-media"
    repo    = var.gitops_repo_url
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command = <<-EOT
      set -euo pipefail
      CTX="kind-social-media"

      if ! kubectl --context "$CTX" get --raw='/readyz' >/dev/null 2>&1; then
        echo "prod-infra needs the kind-social-media cluster, and it is not answering." >&2
        echo "  Apply prod-social first:  social-platform deploy prod-social" >&2
        echo "  Or just start it:         docker start social-media-control-plane social-media-worker social-media-worker2" >&2
        exit 1
      fi

      if ! kubectl --context "$CTX" get crd applications.argoproj.io >/dev/null 2>&1; then
        echo "The cluster is up but ArgoCD is not installed in it (no applications.argoproj.io CRD)." >&2
        echo "  Apply prod-social first:  social-platform deploy prod-social" >&2
        exit 1
      fi

      # The CRD lands with the chart, but a helm_release marked complete does
      # not mean its pods finished starting. Wait for the two that matter for
      # syncing: the controller that reconciles Applications and the repo
      # server that has to read gitops/ from var.gitops_repo_url.
      for deploy in argocd-application-controller argocd-repo-server; do
        kubectl --context "$CTX" -n argocd rollout status "deploy/$deploy" --timeout=300s
      done
    EOT
  }
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
  # --- resource optimization pass ---
  memory = 256   # MB, hard ceiling
  cpus   = "0.3"
  name    = "otel-gateway"
  image   = docker_image.otel_gateway.image_id
  restart = "unless-stopped"
  # It joins the "kind" network below, which only exists once prod-social's
  # cluster does -- the gate keeps that from failing as "network kind not found".
  depends_on = [null_resource.prod_social_ready]

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
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 64
  cpus   = "0.1"
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
  # --- resource optimization pass ---
  memory = 512   # MB, hard ceiling
  cpus   = "0.5"
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
# The single Terraform handle into GitOps for this environment. ArgoCD is
# installed by prod-social, not here: null_resource.prod_social_ready above
# refuses to let this manifest (or the otel-gateway container) run until the
# cluster answers /readyz, the Application CRD is registered and ArgoCD's own
# pods have rolled out. Terragrunt's `dependencies` block still orders the two
# environments; this is what makes a standalone `terragrunt apply` in this
# folder fail with an instruction instead of "argocd not found".
#
# Jenkins, Atlantis, the observability redis credential and Grafana's SMTP
# secret all live in others.tf, commented out -- nothing here needs them, and
# a depends_on pointing at a commented-out resource (which this block used to
# carry for kubectl_manifest.redis_auth_secret) is a hard plan error.
# ---------------------------------------------------------------------------
resource "kubectl_manifest" "app_of_apps_observability" {
  depends_on = [null_resource.prod_social_ready]
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
        targetRevision: deploy
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
