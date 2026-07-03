# Root Terragrunt config. Every environments/prod-*/terragrunt.hcl includes
# this file, which just generates a local backend scoped to that
# environment's own state file -- nothing here injects shared variables,
# because (deliberately) nothing in this project crosses environment
# boundaries via a real Terraform output. Cross-environment coordination is
# either:
#   - a literal string both sides already agree on (e.g. "gateway-net"), or
#   - apply ordering only, expressed via each child's `dependencies` block.
#
# Run everything in the right order with:
#   terragrunt run-all apply
# from the environments/ directory. Run a single environment as normal from
# inside its own folder:
#   cd environments/prod-gateway && terragrunt apply
#
# IMPORTANT: do not add a `terraform { source = ... }` block here. Terragrunt
# also runs this file as a standalone unit (the no-op "infra/environments"
# unit you see in run --all output) -- get_terragrunt_dir() there resolves
# to this folder itself, not to a child, so any source formula meant for
# children breaks when applied here. The source fix for ../../modules and
# ../../projects lives in each child's own terragrunt.hcl instead.

remote_state {
  backend = "local"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    path = "${get_terragrunt_dir()}/terraform.tfstate"
  }
}