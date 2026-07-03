output "network_name" {
  description = "Name of the created docker network (use this, not the resource, in any same-state references)"
  value       = docker_network.this.name
}

output "network_id" {
  value = docker_network.this.id
}
