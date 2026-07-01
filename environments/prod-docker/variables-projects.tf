# Projects root variable for environments that build from local projects

variable "projects_root" {
  description = "Relative path segment from an environment module to the projects directory. Default kept as 'projects' to match existing layout."
  type        = string
  default     = "projects"
}
