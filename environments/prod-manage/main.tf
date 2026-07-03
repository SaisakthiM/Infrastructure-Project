terraform {
  # No provider blocks needed -- this is pure local-exec against the docker
  # CLI, using container/network names as plain strings, not Terraform
  # resource attributes. That's exactly why it can live in its own state
  # without needing to reach into prod-gateway or prod-social's state.
}

# ---------------------------------------------------------------------------
# Connects the "gateway" container (created by environments/prod-gateway) to
# the "kind" network (created by environments/prod-social when its kind
# cluster comes up) so gateway can reach the cluster's NodePorts -- e.g. the
# OTEL collector NodePort at 30317/30318.
#
# Original depends_on=[null_resource.kind_cluster, module.gateway] is gone --
# both of those now live in different Terraform states than this resource.
# Correctness instead comes from terragrunt.hcl's "dependencies" block: this
# environment will refuse to apply before prod-gateway and prod-social have.
# ---------------------------------------------------------------------------
resource "null_resource" "gateway_kind_network" {
  triggers = {
    always_run = timestamp()
  }
  provisioner "local-exec" {
    command = "docker network connect kind gateway || true"
  }
  provisioner "local-exec" {
    when    = destroy
    command = "docker network disconnect kind gateway || true"
  }
  provisioner "local-exec" {
    command = " docker network connect gateway-net gateway_whisper-pgdata || true"
  }
  provisioner "local-exec" {
    command = " docker network connect gateway-net whisper-minio || true"
  }
}
