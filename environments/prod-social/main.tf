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
      version = "~> 3.0"  # This allows 3.x, not just 3.0.0
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}
provider "docker" {
  # Was: unix:///home/saisakthi/.docker/desktop/docker.sock  ← default context, no images here
  host = var.docker_host
}

provider "kubectl" {
  config_path    = "~/.kube/config"
  config_context = "kind-social-media"
}

provider "helm" {
  kubernetes = {
    config_path    = "~/.kube/config"
    config_context = "kind-social-media"
  }
}

provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = "kind-social-media"
}

# ---------------------------------------------------------------------------
# Build images for the social-media workload.
# ---------------------------------------------------------------------------
resource "null_resource" "social_django_image" {
  triggers = {
    # Rebuild when any file in the backend directory changes.
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Social Media App/apps/backend", "**") :
      filesha256("${var.projects_dir}/Social Media App/apps/backend/${f}")
      if !can(regex("(^|/)(node_modules|\\.git|\\.next|__pycache__|\\.venv)/", f))
    ]))
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail

      IMAGE="socialmediaapp-django:latest"
      BACKEND_DIR="${var.projects_dir}/Social Media App/apps/backend"

      # Check if image already exists
      if docker image inspect "$IMAGE" >/dev/null 2>&1; then
        echo "Image $IMAGE already exists, skipping build."
        exit 0
      fi

      echo "Image $IMAGE not found. Building from $BACKEND_DIR ..."
      cd "$BACKEND_DIR"
      docker build -t "$IMAGE" .
      echo "Build complete."
    EOT
  }
}

resource "null_resource" "social_frontend_image" {
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Social Media App/apps/frontend", "**") :
      filesha256("${var.projects_dir}/Social Media App/apps/frontend/${f}")
      if !can(regex("(^|/)(node_modules|\\.git|\\.next)/", f))
    ]))
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      IMAGE="socialmediaapp-frontend:latest"
      FRONTEND_DIR="${var.projects_dir}/Social Media App/apps/frontend"
      if docker image inspect "$IMAGE" >/dev/null 2>&1; then
        echo "Image $IMAGE already exists, skipping build."
        exit 0
      fi
      cd "$FRONTEND_DIR"
      docker build -t "$IMAGE" .
    EOT
  }
}

resource "docker_image" "social_go" {
  name         = "socialmediaapp-microservice-go:latest"
  build {
    context    = abspath("${var.projects_dir}/Social Media App/apps/microservice-go")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Social Media App/apps/microservice-go", "**") :
      filesha256("${var.projects_dir}/Social Media App/apps/microservice-go/${f}")
      if !can(regex(".git", f))
    ]))
  }
}

resource "docker_image" "social_java" {
  name         = "socialmediaapp-microservice-java:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Social Media App/apps/microservice-java")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Social Media App/apps/microservice-java", "**") :
      filesha256("${var.projects_dir}/Social Media App/apps/microservice-java/${f}")
      if !can(regex("(target|.git)", f))
    ]))
  }
}

resource "docker_image" "social_minio" {
  name         = "socialmediaapp-minio:latest"
  keep_locally = true
  build {
    context    = abspath("${var.projects_dir}/Social Media App/storage/minio")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${var.projects_dir}/Social Media App/storage/minio", "**") :
      filesha256("${var.projects_dir}/Social Media App/storage/minio/${f}")
      if !can(regex(".git", f))
    ]))
  }
}

# ---------------------------------------------------------------------------
# kind cluster bootstrap.
# ---------------------------------------------------------------------------
resource "null_resource" "kind_cluster" {
  triggers = {
    kind_config = filesha256("${var.projects_dir}/Social Media App/infrastructure/kind/kind-config.yaml")
  }
  provisioner "local-exec" {
    command = <<-EOT
      if ! kind get clusters | grep -q "social-media"; then
        kind create cluster --config "${abspath("${var.projects_dir}/Social Media App/infrastructure/kind/kind-config.yaml")}"
      fi
    EOT
  }
  provisioner "local-exec" {
    when    = destroy
    command = "kind delete cluster --name social-media"
  }
}

# ---------------------------------------------------------------------------
# Pull Cassandra + Kafka from Docker Hub and inject them directly into every
# kind node via ctr import.
#
# FIX 1: depends_on null_resource.kind_cluster — cluster must exist before
#         we can `docker cp` into the node containers.
# FIX 2: triggers use image digests, not the load_images var — this way the
#         resource only reruns when a new image version is needed, not on
#         every apply where load_images happens to be set.
# FIX 3: skip pull if image is already present locally to avoid re-pulling
#         700 MB on every tainted run.
# ---------------------------------------------------------------------------
resource "null_resource" "kind_images" {
  depends_on = [null_resource.kind_cluster]

  triggers = {
    cassandra_version = "5.0"
    kafka_version     = "7.6.0"
  }

  provisioner "local-exec" {
    environment = {
      DOCKER_HOST = var.docker_host
    }
    command = <<-EOT
      set -e
      cd ~/.cache/

      # ── Cassandra ──────────────────────────────────────────────────────
      if ! docker image inspect cassandra:5.0 > /dev/null 2>&1; then
        echo "Pulling cassandra:5.0..."
        docker pull --platform=linux/amd64 cassandra:5.0
      else
        echo "cassandra:5.0 already present locally, skipping pull."
      fi
      docker save cassandra:5.0 -o cassandra.tar
      for node in social-media-control-plane social-media-worker social-media-worker2; do
        docker cp cassandra.tar $node:/cassandra.tar
        docker exec -i $node ctr -n k8s.io images import /cassandra.tar
        docker exec -i $node rm /cassandra.tar
      done
      rm -f cassandra.tar

      # ── Kafka ──────────────────────────────────────────────────────────
      if ! docker image inspect confluentinc/cp-kafka:7.6.0 > /dev/null 2>&1; then
        echo "Pulling confluentinc/cp-kafka:7.6.0..."
        docker pull --platform=linux/amd64 confluentinc/cp-kafka:7.6.0
      else
        echo "confluentinc/cp-kafka:7.6.0 already present locally, skipping pull."
      fi
      docker save confluentinc/cp-kafka:7.6.0 -o kafka.tar
      for node in social-media-control-plane social-media-worker social-media-worker2; do
        docker cp kafka.tar $node:/kafka.tar
        docker exec -i $node ctr -n k8s.io images import /kafka.tar
        docker exec -i $node rm /kafka.tar
      done
      rm -f kafka.tar
    EOT
  }
}

# ---------------------------------------------------------------------------
# Load the locally-built app images into kind.
#
# FIX 1: depends_on all five docker_image.* resources — kind load must wait
#         until every image build completes. Previously this ran in parallel
#         with the builds, causing "image not present locally" errors.
# FIX 2: depends_on null_resource.kind_images — kind node containers must
#         be fully initialised before we load more images into them.
#         Running both simultaneously caused node filesystem contention.
# ---------------------------------------------------------------------------
resource "null_resource" "kind_load_images" {
  depends_on = [
    null_resource.kind_cluster,
    null_resource.kind_images,
    null_resource.social_django_image,
    null_resource.social_frontend_image,
    docker_image.social_go,
    docker_image.social_java,
    docker_image.social_minio,
  ]

  triggers = {
    # Hash the image tags + the source hashes of the null_resources so this
    # reruns when any image is rebuilt. image_id no longer exists for the
    # null_resource-built images.
    django_sha   = null_resource.social_django_image.triggers.dir_sha
    frontend_sha = null_resource.social_frontend_image.triggers.dir_sha
    go_id        = docker_image.social_go.image_id
    java_id      = docker_image.social_java.image_id
    minio_id     = docker_image.social_minio.image_id
  }

  provisioner "local-exec" {
      environment = {
        DOCKER_HOST = var.docker_host
      }

      command = <<-EOT
        set -e
        for img in socialmediaapp-django:latest \
                  socialmediaapp-frontend:latest \
                  socialmediaapp-microservice-go:latest \
                  socialmediaapp-microservice-java:latest \
                  socialmediaapp-minio:latest; do
          if ! docker image inspect "$img" > /dev/null 2>&1; then
            echo "ERROR: $img not found in local Docker daemon — rebuild first"
            exit 1
          fi
        done
        kind load docker-image socialmediaapp-django:latest            --name social-media
        kind load docker-image socialmediaapp-frontend:latest          --name social-media
        kind load docker-image socialmediaapp-microservice-go:latest   --name social-media
        kind load docker-image socialmediaapp-microservice-java:latest --name social-media
        kind load docker-image socialmediaapp-minio:latest             --name social-media
      EOT
    }
}

# ---------------------------------------------------------------------------
# ArgoCD bootstrap.
# FIX: depends_on kind_images + kind_load_images so ArgoCD install waits
#      until all image loading is complete — avoids "cannot re-use a name
#      that is still in use" from a previous partially-complete install.
# ---------------------------------------------------------------------------
resource "helm_release" "argocd" {
  depends_on = [
    null_resource.kind_cluster,
    null_resource.kind_images,
    null_resource.kind_load_images,
  ]

  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = "7.7.10"
  namespace        = "argocd"
  create_namespace = true
  wait             = true
  timeout          = 300

  values = [
    yamlencode({
      configs = {
        cm = {
          "resource.customizations.ignoreDifferences.apps_StatefulSet" = <<-EOT
            jsonPointers:
            - /status/terminatingReplicas
          EOT
        }
      }
    })
  ]

  set = [
    {
      name  = "repoServer.extraArgs[0]"
      value = "--allow-oob-symlinks"
    },
    {
      name  = "configs.params.server\\.insecure"
      value = "true"
    },
    {
      name  = "configs.params.server\\.rootpath"
      value = "/argocd"
    },
    {
      name  = "configs.params.server\\.basehref"
      value = "/argocd"
    }
  ]
}

resource "kubectl_manifest" "keda_interceptor_proxy" {
  yaml_body = <<-YAML
    apiVersion: v1
    kind: Service
    metadata:
      name: keda-interceptor-proxy
      namespace: argocd
    spec:
      type: ExternalName
      externalName: keda-add-ons-http-interceptor-proxy.keda.svc.cluster.local
      ports:
        - port: 8080
  YAML
}

resource "kubernetes_ingress_v1" "argocd_server" {
  depends_on = [helm_release.argocd]

  metadata {
    name      = "argocd-server-ingress"
    namespace = "argocd"
    annotations = {
      "nginx.ingress.kubernetes.io/backend-protocol" = "HTTP"
      "nginx.ingress.kubernetes.io/ssl-redirect"     = "false"
    }
  }

  spec {
    ingress_class_name = "nginx"
    rule {
      http {
        path {
          path      = "/argocd"
          path_type = "Prefix"
          backend {
            service {
              name = "keda-interceptor-proxy" # <--- CHANGE THIS
              port {
                number = 8080 # <--- AND THIS
              }
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_secret_v1" "gitops_repo_credentials" {
  depends_on = [helm_release.argocd]
  metadata {
    name      = "coding-project-repo"
    namespace = "argocd"
    labels = {
      "argocd.argoproj.io/secret-type" = "repository"
    }
  }
  data = {
    type          = "git"
    url           = var.gitops_repo_url
    sshPrivateKey = var.gitops_repo_ssh_key
  }
}

resource "kubectl_manifest" "postgres_secret" {
  depends_on = [null_resource.kind_cluster]
  yaml_body  = <<-YAML
    apiVersion: v1
    kind: Secret
    metadata:
      name: postgres-secret
    type: Opaque
    data:
      POSTGRES_PASSWORD: ${base64encode(var.social_db_password)}
  YAML
}

resource "kubectl_manifest" "social_minio_secret" {
  depends_on = [null_resource.kind_cluster]
  yaml_body  = <<-YAML
    apiVersion: v1
    kind: Secret
    metadata:
      name: social-minio-secret
    type: Opaque
    data:
      MINIO_ROOT_USER: ${base64encode(var.social_minio_user)}
      MINIO_ROOT_PASSWORD: ${base64encode(var.social_minio_password)}
  YAML
}

resource "kubectl_manifest" "app_of_apps_social" {
  depends_on = [
    helm_release.argocd,
    kubectl_manifest.postgres_secret,
    kubectl_manifest.social_minio_secret,
  ]
  yaml_body  = <<-YAML
    apiVersion: argoproj.io/v1alpha1
    kind: Application
    metadata:
      name: social-media-app-of-apps
      namespace: argocd        # ← ADD THIS
    spec:
      project: default
      source:
        repoURL: ${var.gitops_repo_url}
        targetRevision: HEAD
        path: gitops/social-media/apps
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

resource "kubernetes_namespace" "consul" {
  metadata {
    name = "consul"
  }
}


resource "helm_release" "consul" {
  name       = "consul"
  repository = "https://helm.releases.hashicorp.com"
  chart      = "consul"
  version    = "1.6.2"          # pin to whatever's current when you run this
  namespace  = kubernetes_namespace.consul.metadata[0].name

  values = [
    yamlencode({
      global = { name = "consul", datacenter = "dc1" }
      server = {
        replicas        = 1
        bootstrapExpect = 1
        extraConfig     = jsonencode({
          ui_config = {
            enabled      = true
            content_path = "/consul/"
          }
        })
      }
      connectInject = { enabled = false }
      ui            = { enabled = true }
      client        = { enabled = true }
      syncCatalog   = {
        enabled   = true
        default   = true
        toConsul  = true
        toK8S     = false
        k8sPrefix = ""
      }
    })
  ]
}

resource "kubectl_manifest" "consul_ingress" {
  yaml_body = <<-YAML
    apiVersion: networking.k8s.io/v1
    kind: Ingress
    metadata:
      name: consul-ui
      namespace: consul
    spec:
      ingressClassName: nginx
      rules:
        - http:
            paths:
              - path: /consul/
                pathType: Prefix
                backend:
                  service:
                    name: consul-ui
                    port:
                      number: 80
              - path: /v1
                pathType: Prefix
                backend:
                  service:
                    name: consul-ui
                    port:
                      number: 80
  YAML
}
# ---------------------------------------------------------------------------
# KEDA + HTTP add-on.
#
# Kept here (not gitops/) because it's cluster infrastructure Terraform
# already owns directly in this file -- same category as helm_release.argocd
# and helm_release.consul above, not an application workload. Light resource
# footprint on purpose, since today's pass is about cutting overhead, not
# adding more of it.
# ---------------------------------------------------------------------------
resource "helm_release" "keda" {
  depends_on       = [null_resource.kind_cluster]
  name             = "keda"
  repository       = "https://kedacore.github.io/charts"
  chart            = "keda"
  namespace        = "keda"
  create_namespace = true

  set = [
    { name = "resources.operator.requests.cpu",      value = "50m" },
    { name = "resources.operator.requests.memory",   value = "128Mi" },
    { name = "resources.operator.limits.cpu",        value = "200m" },
    { name = "resources.operator.limits.memory",     value = "256Mi" },
    { name = "resources.metricServer.requests.cpu",    value = "50m" },
    { name = "resources.metricServer.requests.memory", value = "128Mi" },
    { name = "resources.metricServer.limits.cpu",      value = "200m" },
    { name = "resources.metricServer.limits.memory",   value = "256Mi" },
  ]
}

resource "helm_release" "keda_http_add_on" {
  depends_on = [helm_release.keda]
  name       = "http-add-on"
  repository = "https://kedacore.github.io/charts"
  chart      = "keda-add-ons-http"
  namespace  = "keda"
}

# ---------------------------------------------------------------------------
# HTTPScaledObject coverage.
#
# Everything under gitops/social-media/apps and gitops/observability/apps
# (app_of_apps_social / app_of_apps_observability above) is ArgoCD-managed --
# deliberately excluded, since those workloads belong to that sync loop, not
# to a resource this state should be reaching into individually.
#
# That leaves, across every .tf file in this repo, exactly one safe
# candidate: argocd-server itself (helm_release.argocd + the ingress right
# above). Everything else that isn't ArgoCD-managed is either:
#   - a plain Docker container on the host (n8n, jenkins, atlantis, the
#     docker_app-module backends, etc.) -- HTTPScaledObject is a Kubernetes
#     CRD, it has nothing to attach to there, or
#   - Consul, which IS in-cluster, but its UI is served by the "server"
#     StatefulSet's own Raft-voting pods -- scaling that to/from zero risks
#     the quorum, so it's left alone on purpose.
#
# argocd-server is stateless (state lives in etcd + redis, not in the
# server pod), so scale-to-zero when nobody's looking at the UI is safe.
# ---------------------------------------------------------------------------
resource "kubectl_manifest" "httpscaledobject_argocd_server" {
  depends_on = [
    kubernetes_ingress_v1.argocd_server,
    helm_release.keda_http_add_on,
  ]
  yaml_body = <<-YAML
    apiVersion: http.keda.sh/v1alpha1
    kind: HTTPScaledObject
    metadata:
      name: argocd-server
      namespace: argocd
    spec:
      pathPrefixes:
        - /argocd
      scaleTargetRef:
        name: argocd-server
        kind: Deployment
        service: argocd-server
        port: 80
      replicas:
        min: 0
        max: 2
      scalingMetric:
        concurrency:
          targetValue: 10
      scaledownPeriod: 600
  YAML
}
