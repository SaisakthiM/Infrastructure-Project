# Update: environments + infra-cli

Copy each folder over your repo (same paths).

## environments/
- `prod-gateway/nginx/default.conf` — NEW routes: `/city-core/`, `/grocery/api/`, `/housing/api/`
- `prod-gateway/main.tf` — serves city-core; housing now copies `projects/housing/frontend`
- `prod-docker/main.tf`, `variable.tf` — grocery + housing backend containers, persistent volumes
  (video uploads/stats, hospital metrics, api-service exchange data, grocery, housing),
  new variable `grocery_secret_key`
- **Image build bug fixed**: the image builders skipped `docker build` when the image already existed,
  so edited code was never deployed. They now rebuild whenever the sources change and containers use a
  content-hash tag, so they are replaced too. Frontend build containers use the image ID for the same reason.
- Nothing in terraform.tfvars changed (the CLI generates `grocery_secret_key`).

## infra-cli/
- `use [folder]` / `--dir` — deploy from a folder you pick (e.g. `~/Infrastructure-Project`); copies existing
  Terraform state over (never overwrites state already there)
- `sync` (alias `pull`) — `git fetch` + fast-forward (`--autostash`, `--rebase`, `--dry-run`, `--deploy`);
  only tracked files change; state, caches and tfvars are untouched; reports affected environments
- Missing variables: reads every `variable.tf`; `configure --missing`; deploy/sync ask for anything without a
  value; values you typed into tfvars by hand are adopted, not overwritten
  (the old generator dropped `smtp_user` / `smtp_password`)
- No keychain (WSL/headless) no longer breaks `configure`: falls back to `~/.social-platform/secrets.json` (0600)
- `update` no longer deletes local Terraform state (opt in with `--wipe-state`) and refuses to overwrite your own folder
- Shared Terraform provider cache (`~/.terraform.d/plugin-cache`)
- Web UI: 3D cluster map, "Source & Sync" panel, "Terraform variables" panel
- The TUI is unchanged (it cannot be 3D); run `social-platform configure --missing` before deploying from it
