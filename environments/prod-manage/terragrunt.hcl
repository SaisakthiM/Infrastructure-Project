include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_terragrunt_dir()}/../..//environments/${basename(get_terragrunt_dir())}"
}

dependencies {
  # Ordering only: the "gateway" container (prod-gateway) and the "kind"
  # docker network (created when prod-social's kind cluster comes up) both
  # have to exist before `docker network connect kind gateway` means
  # anything.
  paths = ["../prod-gateway", "../prod-social"]
}