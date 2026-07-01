variable "docker_host" {
  description = "Docker provider socket/endpoint, e.g. unix:///home/you/.docker/desktop/docker.sock"
}


variable "projects_dir" {
  description = "Absolute path to the projects/ directory containing all project source repos (Bank Manager, Blog Website, Whisper, etc). Auto-detected and written to terraform.tfvars by the CLI (social-platform configure)."
  type        = string
}
