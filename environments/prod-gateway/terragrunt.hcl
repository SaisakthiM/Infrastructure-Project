include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_terragrunt_dir()}/../..//environments/${basename(get_terragrunt_dir())}"
}

# No dependencies block: this environment is the foundation. Nothing in
# Terraform should ever need to apply before prod-gateway does.