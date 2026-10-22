# ===========================================================================
# prod-social -- others.tf
#
# Commented-out Terraform for this environment: the Consul service mesh/UI
# (switched off -- Consul's catalog sync and its Raft quorum cost more than
# the single-cluster city earns from it today) and the variable declarations
# nothing in main.tf reads any more.
#
# TO RE-ENABLE: un-comment the block(s) you want, plus any `variable` at the
# bottom, then `terragrunt apply` in this folder. Apply prod-social's own
# kind cluster + ArgoCD first -- helm_release.consul needs the cluster, and
# the ingress needs the `nginx` IngressClass that ArgoCD installs.
#
# Watch out for two things Consul specifically has caused before:
#   - helm_release.consul pins chart 1.6.2; the `namespace` argument reads
#     kubernetes_namespace.consul, so un-comment the namespace block too.
#   - Its UI is served by the "server" StatefulSet's own Raft-voting pods, so
#     do NOT add an HTTPScaledObject for it (see the note in main.tf).
# ===========================================================================

# resource "kubernetes_namespace" "consul" {
#   metadata {
#     name = "consul"
#   }
# }

# resource "helm_release" "consul" {
#   name       = "consul"
#   repository = "https://helm.releases.hashicorp.com"
#   chart      = "consul"
#   version    = "1.6.2"          # pin to whatever's current when you run this
#   namespace  = kubernetes_namespace.consul.metadata[0].name

#   values = [
#     yamlencode({
#       global = { name = "consul", datacenter = "dc1" }
#       server = {
#         replicas        = 1
#         bootstrapExpect = 1
#         extraConfig     = jsonencode({
#           ui_config = {
#             enabled      = true
#             content_path = "/consul/"
#           }
#         })
#       }
#       connectInject = { enabled = false }
#       ui            = { enabled = true }
#       client        = { enabled = true }
#       syncCatalog   = {
#         enabled   = true
#         default   = true
#         toConsul  = true
#         toK8S     = false
#         k8sPrefix = ""
#       }
#     })
#   ]
# }

# resource "kubectl_manifest" "consul_ingress" {
#   yaml_body = <<-YAML
#     apiVersion: networking.k8s.io/v1
#     kind: Ingress
#     metadata:
#       name: consul-ui
#       namespace: consul
#     spec:
#       ingressClassName: nginx
#       rules:
#         - http:
#             paths:
#               - path: /consul/
#                 pathType: Prefix
#                 backend:
#                   service:
#                     name: consul-ui
#                     port:
#                       number: 80
#               - path: /v1
#                 pathType: Prefix
#                 backend:
#                   service:
#                     name: consul-ui
#                     port:
#                       number: 80
#   YAML
# }

# ===========================================================================
# Variables with no consumer in this environment.
#
# smtp_user / smtp_password are the important ones: they were declared without
# a `default`, and `social-platform configure --regen` never writes them into
# this folder's terraform.tfvars -- so every prod-social apply ended in
# "No value for required variable" (and the dashboard's preflight refused to
# even start the job). Grafana's SMTP secret, the only thing that ever read
# them, is in prod-infra/others.tf.
#
# If you hand-added smtp_user / smtp_password to
# environments/prod-social/terraform.tfvars, delete those two lines: an
# assignment with no declaration is a Terraform warning on every plan.
# ===========================================================================

# variable "smtp_user" {
#   type    = string
#   default = "saisakthicloud@gmail.com"
# }

# variable "smtp_password" {
#   type      = string
#   sensitive = true
# }
