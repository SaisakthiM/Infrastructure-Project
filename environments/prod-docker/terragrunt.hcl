include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_terragrunt_dir()}/../..//environments/${basename(get_terragrunt_dir())}"
}

dependencies {
  # Ordering only -- this environment doesn't read any output from
  # prod-gateway, it just needs the "gateway-net" docker network to already
  # exist before its containers try to join it by that literal name.
  paths = ["../prod-gateway"]
}