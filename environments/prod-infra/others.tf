# ===========================================================================
# prod-infra -- others.tf
#
# Real Terraform for the things this city does not run today: Jenkins + its
# inbound agent, Atlantis (PR-gated terragrunt), the observability Redis
# credential, and Grafana's SMTP secret. Every block here is commented out on
# purpose, so `terragrunt apply` never plans, refreshes, or orders anything in
# this file -- main.tf is left holding exactly the resources and variables
# prod-infra actually needs.
#
# HOW TO RE-ENABLE ONE BLOCK
#   1. Un-comment the resource(s) below, plus the matching `variable`
#      declaration(s) at the bottom of this file.
#   2. Give the values. Jenkins needs none. Atlantis needs the three
#      atlantis_gh_* values, which `social-platform configure --regen` no
#      longer writes (see step 3). redis needs observability_redis_password,
#      which is still declared in variable.tf with a default.
#   3. For Atlantis only: un-comment the `# ─── Atlantis ───` assignments in
#      generateInfraTfvars (infra-cli/internal/secrets/secrets.go) so the CLI
#      puts the values back into terraform.tfvars -- or set them by hand.
#      The GitHub token stays in the keychain either way; `social-platform
#      release` reads it directly for its GitHub API calls.
#   4. For the Redis secret only: move
#      gitops/observability/unsynced/observability-redis-app.yaml back into
#      gitops/observability/apps/ -- that Deployment consumes
#      redis-auth-secret, and it sits outside the synced directory precisely
#      because the secret does not exist right now.
#   5. Apply prod-social first: everything below needs the kind-social-media
#      cluster, and the two Kubernetes-native blocks also need ArgoCD's
#      `monitoring` namespace, which the observability app-of-apps creates.
#
# WHY grafana_smtp IS NOT IN main.tf
#   It writes a Secret into namespace `monitoring`, which no Terraform
#   resource in any state creates -- ArgoCD creates it when
#   kube-prometheus-stack-app syncs. On a clean apply that race fails with
#   `namespaces "monitoring" not found`, and prod-infra has no
#   `provider "kubernetes"` block at all, so the secret would land in whatever
#   context ~/.kube/config happens to default to. The `provider` block below
#   fixes the second half; un-comment it together with the secret. Nothing in
#   gitops/ or projects/platform/observability references a `grafana-smtp`
#   secret today, so there is no consumer waiting on it.
# ===========================================================================

# provider "kubernetes" {
#   config_path    = "~/.kube/config"
#   config_context = "kind-social-media"
# }

# ---------------------------------------------------------------------------
# Grafana SMTP credentials (no consumer -- see the header above)
# ---------------------------------------------------------------------------
# resource "kubernetes_secret_v1" "grafana_smtp" {
#   metadata {
#     name      = "grafana-smtp"
#     namespace = "monitoring"
#   }
#
#   type = "Opaque"
#
#   # Plain strings here: the provider base64-encodes `data` for you
#   data = {
#     user     = var.smtp_user
#     password = var.smtp_password
#   }
# }

# # ---------------------------------------------------------------------------
# # Jenkins + agent
# # ---------------------------------------------------------------------------
# resource "docker_volume" "jenkins_home" { name = "jenkins_home" }

# resource "docker_image" "jenkins" {
#   name         = "jenkins/jenkins:lts"
#   keep_locally = true
# }

# resource "docker_container" "jenkins" {
#   # --- resource optimization pass ---
#   memory = 1536   # MB, hard ceiling
#   cpus   = "1.0"
#   name    = "jenkins"
#   image   = docker_image.jenkins.image_id
#   restart = "unless-stopped"

#   env = [
#     "JENKINS_OPTS=--prefix=/jenkins",
#     "JAVA_OPTS=-Djava.awt.headless=true -Dhudson.security.csrf.GlobalCrumbIssuerConfiguration.DISABLE_CSRF_PROTECTION=true"
#     ]

#   ports {
#     internal = 8080
#     external = 8090
#   }
#   ports {
#     internal = 50000
#     external = 50000
#   }

#   volumes {
#     volume_name    = docker_volume.jenkins_home.name
#     container_path = "/var/jenkins_home"
#   }
#   volumes {
#     host_path      = "/var/run/docker.sock"
#     container_path = "/var/run/docker.sock"
#   }

#   networks_advanced {
#     name = "gateway-net"
#   }
# }

# resource "docker_image" "jenkins_agent" {
#   name         = "jenkins/inbound-agent:latest"
#   keep_locally = true
# }

# resource "docker_container" "jenkins_agent" {
#   # --- resource optimization pass ---
#   memory = 1024   # MB, hard ceiling
#   cpus   = "1.0"
#   name    = "jenkins-agent"
#   image   = docker_image.jenkins_agent.image_id
#   restart = "unless-stopped"

#   env = [
#     "JENKINS_URL=http://jenkins:8080/jenkins/",
#     "JENKINS_AGENT_NAME=Worker",
#     "JENKINS_SECRET=af8a382676b767a8d8a33aaf1824256892d08a8f1fb6ff98ec0070fbbf689c66",
#     "JENKINS_AGENT_WORKDIR=/home/jenkins/agent",
#   ]

#   volumes {
#     host_path      = "/var/run/docker.sock"
#     container_path = "/var/run/docker.sock"
#   }

#   networks_advanced {
#     name = "gateway-net"
#   }
#   volumes {
#     host_path      = abspath("${path.module}/variable.tf")
#     container_path = "/etc/terraform/terraform.tfvars"
#   }

#   provisioner "local-exec" {
#     command = <<-EOT
#       sleep 5
#       docker exec --user root jenkins-agent bash -c "
#         apt-get update -qq &&
#         apt-get install -y docker.io wget unzip &&
#         chmod 666 /var/run/docker.sock &&
#         wget -q https://releases.hashicorp.com/terraform/1.9.0/terraform_1.9.0_linux_amd64.zip &&
#         unzip terraform_1.9.0_linux_amd64.zip &&
#         mv terraform /usr/local/bin/ &&
#         rm terraform_1.9.0_linux_amd64.zip &&
#         chown -R jenkins:jenkins /home/jenkins &&
#         echo 'Done!'
#       "
#     EOT
#   }

#   depends_on = [docker_container.jenkins]
# }

# # ---------------------------------------------------------------------------
# # Atlantis -- PR-gated terraform/terragrunt plan+apply.
# #
# # Has to run on this same box: it needs the literal docker socket path
# # prod-gateway/prod-docker's "docker" provider hardcodes
# # (/home/saisakthi/.docker/desktop/docker.sock), and ~/.kube/config with the
# # kind-social-media context that prod-social/prod-infra's kubectl/helm/
# # kubernetes providers read. Neither is reachable from a remote runner.
# #
# # BOOTSTRAP NOTE: this block itself has to go through one manual
# # `terragrunt apply` from your terminal before Atlantis exists to apply
# # anything -- same chicken-and-egg as helm_release.argocd in prod-social.
# # Every prod-infra change AFTER that first apply can go through a PR.
# # ---------------------------------------------------------------------------
# resource "docker_volume" "atlantis_data" { name = "gateway_atlantis-data" }

# resource "docker_image" "atlantis" {
#   name         = "atlantis-terragrunt:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${path.module}/atlantis")
#     dockerfile = "Dockerfile"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${path.module}/atlantis", "**") :
#       filesha256("${path.module}/atlantis/${f}")
#     ]))
#   }
# }

# resource "null_resource" "atlantis_ssh_key" {
#   triggers = {
#     always = timestamp()
#   }

#   provisioner "local-exec" {
#     command = <<-EOT
#       mkdir -p /home/saisakthi/.atlantis-ssh
#       chmod 700 /home/saisakthi/.atlantis-ssh

#       # generate key if it doesn't already exist
#       if [ ! -f /home/saisakthi/.atlantis-ssh/id_ed25519 ]; then
#         ssh-keygen -t ed25519 -f /home/saisakthi/.atlantis-ssh/id_ed25519 -N "" -C "atlantis@docker"
#       fi

#       chmod 600 /home/saisakthi/.atlantis-ssh/id_ed25519
#       chmod 644 /home/saisakthi/.atlantis-ssh/id_ed25519.pub

#       # add to authorized_keys if not already present
#       PUBKEY=$(cat /home/saisakthi/.atlantis-ssh/id_ed25519.pub)
#       if ! grep -qF "$PUBKEY" /home/saisakthi/.ssh/authorized_keys 2>/dev/null; then
#         echo "$PUBKEY" >> /home/saisakthi/.ssh/authorized_keys
#         chmod 600 /home/saisakthi/.ssh/authorized_keys
#       fi
#     EOT
#   }
# }

# resource "docker_container" "atlantis" {
#   # --- resource optimization pass ---
#   memory = 512   # MB, hard ceiling
#   cpus   = "0.5"
#   name    = "atlantis"
#   image   = docker_image.atlantis.image_id
#   restart = "unless-stopped"
#   depends_on = [null_resource.atlantis_ssh_key]

#   # Has to be root (or a uid that can read them) to use the bind-mounted
#   # docker.sock and ~/.kube/config below -- same tradeoff jenkins_agent
#   # already makes for its own docker.sock mount above.
#   user = "0:0"

#   env = [
#     "ATLANTIS_GH_USER=${var.atlantis_gh_user}",
#     "ATLANTIS_GH_TOKEN=${var.atlantis_gh_token}",
#     "ATLANTIS_GH_WEBHOOK_SECRET=${var.atlantis_gh_webhook_secret}",
#     "ATLANTIS_REPO_ALLOWLIST=${var.gitops_repo_url}",
#     "ATLANTIS_PORT=4141",
#     "ATLANTIS_ATLANTIS_URL=https://${var.domain}/atlantis",
#     "ATLANTIS_DATA_DIR=/atlantis-data",
#     "ATLANTIS_REPO_CONFIG=/etc/atlantis/repos.yaml",
#     # "~" in prod-social/prod-infra's provider config_path blocks resolves
#     # against this -- has to match where the kubeconfig volume below lands.
#     "HOME=/home/saisakthi",
#   ]

#   volumes {
#     volume_name    = docker_volume.atlantis_data.name
#     container_path = "/atlantis-data"
#   }
#   volumes {
#     host_path      = abspath("${path.module}/atlantis/repos.yaml")
#     container_path = "/etc/atlantis/repos.yaml"
#     read_only      = true
#   }

#   volumes {
#     host_path      = "/home/saisakthi/.atlantis-ssh"
#     container_path = "/root/.ssh"
#     read_only      = true
#   }
#   # Identical absolute path inside the container as the host, on purpose --
#   # the "docker" provider's host = "unix:///home/saisakthi/..." string gets
#   # evaluated wherever Terraform itself is running, i.e. inside THIS
#   # container once Atlantis applies anything. It has to find a real socket
#   # at that exact path.
#   volumes {
#     host_path      = "/var/run/docker.sock"   # ← this, not the Desktop socket path
#     container_path = "/var/run/docker.sock"
#     read_only      = false
#   }
#   # Same idea for the kind-social-media kubeconfig context.
#   volumes {
#     host_path      = "/home/saisakthi/.kube"
#     container_path = "/home/saisakthi/.kube"
#   }

#   networks_advanced {
#     name = "gateway-net"
#   }
# }

# # ---------------------------------------------------------------------------
# # Credential kept out of git, referenced by
# # gitops/observability/unsynced/observability-redis-app.yaml via
# # auth.existingSecret (see re-enable step 4 in the header). Un-commenting
# # this alone does nothing until that Deployment comes back too -- and while
# # it is commented, this environment must not leave redis-auth-secret missing
# # inside the synced apps/ directory, which is why that file moved out.
# # ---------------------------------------------------------------------------
# resource "kubectl_manifest" "redis_auth_secret" {
#   depends_on = [null_resource.prod_social_ready]
#   yaml_body = <<-YAML
#     apiVersion: v1
#     kind: Secret
#     metadata:
#       name: redis-auth-secret
#     type: Opaque
#     data:
#       REDIS_PASSWORD: ${base64encode(var.observability_redis_password)}
#   YAML
# }

# ===========================================================================
# Variables that only the blocks above use.
#
# They live here, commented, because a `variable` declaration without a
# `default` is a hard requirement: `social-platform deploy` refuses to start
# (and a plain `terragrunt apply` fails outright) until every one of them has
# a value -- even with Atlantis and Jenkins switched off. Un-comment the ones
# you re-enable.
#
# `observability_redis_password` deliberately stays in variable.tf: the CLI
# already writes it into terraform.tfvars, and it has a default.
# ===========================================================================

# variable "domain" {
#   description = "Your public domain -- used by Atlantis' ATLANTIS_ATLANTIS_URL."
#   type        = string
#   default     = "saisakthi.qzz.io"
# }

# variable "main_server_ip" {
#   description = "IP of your main server -- nothing reads it today; kept for the n8n node configs."
#   type        = string
#   default     = "192.168.31.227"
# }

# variable "smtp_user" {
#   type    = string
#   default = "saisakthicloud@gmail.com"
# }

# variable "smtp_password" {
#   type      = string
#   sensitive = true
# }

# ─── Atlantis ───────────────────────────────────────────────
# variable "atlantis_gh_user" {
#   description = "GitHub username Atlantis authenticates and comments as."
#   type        = string
# }

# variable "atlantis_gh_token" {
#   description = "Personal access token for atlantis_gh_user. Needs 'repo' scope (or 'public_repo' if Coding-Project is public) so Atlantis can read PR status, post comments, and set commit statuses."
#   type        = string
#   sensitive   = true
# }

# variable "atlantis_gh_webhook_secret" {
#   description = "Shared secret Atlantis uses to verify GitHub webhook payloads are genuinely from GitHub. Generate with `openssl rand -hex 32`; the exact same string has to be pasted into the webhook's 'Secret' field in GitHub's repo settings."
#   type        = string
#   sensitive   = true
# }
