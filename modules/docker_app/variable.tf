variable "name" {}
variable "image" {}
variable "internal_port" { type = number }
variable "external_port" { type = number }
variable "network" { type = string }

variable "env" {
  type    = list(string)
  default = []
}

variable "command" {
  type    = list(string)
  default = []
}

variable "volumes" {
  description = "Bind mounts (host path → container path)"
  type = list(object({
    host_path      = string
    container_path = string
    read_only      = bool
  }))
  default = []
}

variable "named_volumes" {
  description = "Named Docker volumes (volume name → container path)"
  type = list(object({
    volume_name    = string
    container_path = string
    read_only      = bool
  }))
  default = []
}

variable "memory" {
  description = "Hard memory ceiling in MB. Leave unset for no limit."
  type        = number
  default     = null
}

variable "cpus" {
  description = "CPU cap, e.g. \"0.5\" for half a core. Leave unset for no limit."
  type        = string
  default     = null
}