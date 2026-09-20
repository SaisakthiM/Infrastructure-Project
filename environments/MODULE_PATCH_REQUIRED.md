# modules/docker_app needs a `memory` + `cpus` passthrough

That module wasn't in the zip you uploaded (it lives at ../../modules/docker_app,
outside environments/), so the `memory`/`cpus` args added to every `module "..."`
block in prod-docker/main.tf, prod-gateway/main.tf, and prod-infra/main.tf will
fail `terraform plan` with "Unsupported argument" until the module itself
accepts and forwards them.

Add to modules/docker_app/variables.tf:

```hcl
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
```

And on the `docker_container` resource inside modules/docker_app/main.tf, add:

```hcl
  memory = var.memory
  cpus   = var.cpus
```

Both default to `null` (no limit), so every existing call site that doesn't
pass them keeps working unchanged -- only the module calls in this repo that
now set `memory`/`cpus` explicitly will actually get capped.
