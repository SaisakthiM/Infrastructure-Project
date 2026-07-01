variable "projects_root" {
  description = "Relative path from module to the projects directory (used to replace hardcoded ../../projects). Relative to path.module."
  type        = string
  default     = "../../projects"
}
