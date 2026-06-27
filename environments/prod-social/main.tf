terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    kubectl = {
      source = "gavinbunney/kubectl"
    }
    helm = {
      source = "hashicorp/helm"
    }
  }
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
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
resource "docker_image" "social_django" {
  name         = "socialmediaapp-django:latest"
  keep_locally = true
  build {
    context    = abspath("${path.module}/../../projects/Social Media App/apps/backend")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${path.module}/../../projects/Social Media App/apps/backend", "**") :
      filesha256("${path.module}/../../projects/Social Media App/apps/backend/${f}")
      if !can(regex("(__pycache__|.pyc|.git)", f))
    ]))
  }
}

resource "docker_image" "social_frontend" {
  name         = "socialmediaapp-frontend-prod:latest"
  keep_locally = true
  build {
    context    = abspath("${path.module}/../../projects/Social Media App/apps/frontend")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${path.module}/../../projects/Social Media App/apps/frontend", "**") :
      filesha256("${path.module}/../../projects/Social Media App/apps/frontend/${f}")
      if !can(regex("(node_modules|dist|.git)", f))
    ]))
  }
}

resource "docker_image" "social_go" {
  name         = "socialmediaapp-microservice-go:latest"
  keep_locally = true
  build {
    context    = abspath("${path.module}/../../projects/Social Media App/apps/microservice-go")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${path.module}/../../projects/Social Media App/apps/microservice-go", "**") :
      filesha256("${path.module}/../../projects/Social Media App/apps/microservice-go/${f}")
      if !can(regex(".git", f))
    ]))
  }
}

resource "docker_image" "social_java" {
  name         = "socialmediaapp-microservice-java:latest"
  keep_locally = true
  build {
    context    = abspath("${path.module}/../../projects/Social Media App/apps/microservice-java")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${path.module}/../../projects/Social Media App/apps/microservice-java", "**") :
      filesha256("${path.module}/../../projects/Social Media App/apps/microservice-java/${f}")
      if !can(regex("(target|.git)", f))
    ]))
  }
}

resource "docker_image" "social_minio" {
  name         = "socialmediaapp-minio:latest"
  keep_locally = true
  build {
    context    = abspath("${path.module}/../../projects/Social Media App/storage/minio")
    dockerfile = "Dockerfile"
  }
  triggers = {
    dir_sha = sha256(join("", [
      for f in fileset("${path.module}/../../projects/Social Media App/storage/minio", "**") :
      filesha256("${path.module}/../../projects/Social Media App/storage/minio/${f}")
      if !can(regex(".git", f))
    ]))
  }
}

# ---------------------------------------------------------------------------
# kind cluster bootstrap.
# ---------------------------------------------------------------------------
resource "null_resource" "kind_cluster" {
  triggers = {
    kind_config = filesha256("${path.module}/../../projects/Social Media App/infrastructure/kind/kind-config.yaml")
  }
  provisioner "local-exec" {
    command = <<-EOT
      if ! kind get clusters | grep -q "social-media"; then
        kind create cluster --config "${abspath("${path.module}/../../projects/Social Media App/infrastructure/kind/kind-config.yaml")}"
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
    null_resource.kind_images,       # FIX: wait for infra images to finish
    docker_image.social_django,
    docker_image.social_frontend,
    docker_image.social_go,
    docker_image.social_java,
    docker_image.social_minio,
  ]

  triggers = {
    django_id   = docker_image.social_django.image_id
    frontend_id = docker_image.social_frontend.image_id
    go_id       = docker_image.social_go.image_id
    java_id     = docker_image.social_java.image_id
    minio_id    = docker_image.social_minio.image_id
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      kind load docker-image socialmediaapp-django:latest          --name social-media
      kind load docker-image socialmediaapp-frontend-prod:latest   --name social-media
      kind load docker-image socialmediaapp-microservice-go:latest --name social-media
      kind load docker-image socialmediaapp-microservice-java:latest --name social-media
      kind load docker-image socialmediaapp-minio:latest           --name social-media
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

  # FIX: skip reinstall if already deployed (e.g. after a partial apply
  #      wiped state but left the Helm release in the cluster).
  lifecycle {
    ignore_changes = [metadata]
  }

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
    }
  ]
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
              name = "argocd-server"
              port {
                number = 80
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
    url           = "git@github.com:SaisakthiM/Coding-Project.git"
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
      namespace: argocd
    spec:
      project: default
      source:
        repoURL: ${var.gitops_repo_url}
        targetRevision: HEAD
        path: Projects/Finished Projects/Docker/Terraform/infra/gitops/social-media/apps
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