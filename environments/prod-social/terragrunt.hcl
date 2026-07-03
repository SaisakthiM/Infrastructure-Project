include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_terragrunt_dir()}/../..//environments/${basename(get_terragrunt_dir())}"
}

# No dependencies block: nothing here touches "gateway-net" or any other
# prod-gateway resource, so this can apply independently and in parallel
# with prod-gateway during `terragrunt run-all apply`.