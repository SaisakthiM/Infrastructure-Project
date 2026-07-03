include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_terragrunt_dir()}/../..//environments/${basename(get_terragrunt_dir())}"
}

dependencies {
  # Ordering only, no outputs consumed:
  #   prod-gateway -- otel-gateway/n8n/jenkins join "gateway-net" by name.
  #   prod-social  -- ArgoCD must already be installed before this
  #                   environment's app_of_apps_observability Application
  #                   can sync, and the kind cluster obviously has to exist
  #                   for the kubectl provider to reach it at all.
  paths = ["../prod-gateway", "../prod-social"]
}