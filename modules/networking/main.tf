variable "name" {
  description = "Name of the docker network"
  type        = string
}

variable "driver" {
  description = "Docker network driver"
  type        = string
  default     = "bridge"
}

resource "docker_network" "this" {
  name   = var.name
  driver = var.driver
}
