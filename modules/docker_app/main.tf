resource "docker_container" "app" {
  name    = var.name
  image   = var.image
  restart = "always"

  env     = var.env
  command = length(var.command) > 0 ? var.command : null

  dynamic "ports" {
    for_each = var.external_port != 0 ? [1] : []
    content {
      internal = var.internal_port
      external = var.external_port
    }
  }

  networks_advanced {
    name = var.network
  }

  dynamic "mounts" {
    for_each = var.volumes
    content {
      source    = mounts.value.host_path
      target    = mounts.value.container_path
      type      = "bind"
      read_only = mounts.value.read_only
    }
  }

  dynamic "mounts" {
    for_each = var.named_volumes
    content {
      source    = mounts.value.volume_name
      target    = mounts.value.container_path
      type      = "volume"
      read_only = mounts.value.read_only
    }
  }
}
