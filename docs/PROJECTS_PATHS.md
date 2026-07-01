# Projects paths - configuration and autoscan

This document explains the files added by the `fix-paths` branch and how to use them.

Files added:

- `environments/variables-projects.tf` — declares `variable "projects_root"` with default `"../../projects"`.
- `environments/projects.auto.tfvars` — Terraform auto-loaded tfvars file that sets `projects_root` (created by infra-cli scripts).
- `scripts/replace_projects_root.sh` — safe replacement script to substitute hardcoded `../../projects` occurrences with `${var.projects_root}`. Creates .bak backups.
- `infra-cli/paths.py` — small helper to prompt for `projects_root` and/or autoscan the repo for `projects` directories. Writes `infra-cli/paths.json` and `environments/projects.auto.tfvars`.
- `infra-cli/check_paths.py` — scanner that finds references and writes `infra-cli/missing_paths.json` with present/missing lists.
- `infra-cli/tui_show_missing.py` — simple TUI (requires `rich`) to display missing paths.

How to use (after pulling the branch):

1. Install Python 3.9+ and (optionally) `pip install rich` for the TUI.
2. Run `python3 infra-cli/paths.py --autoscan` to discover a `projects` directory and set `projects_root` automatically, or run `python3 infra-cli/paths.py` to be prompted.
3. Run `python3 infra-cli/check_paths.py` to produce `infra-cli/missing_paths.json`.
4. Run `python3 infra-cli/tui_show_missing.py` to view missing entries in the terminal.
5. After reviewing, run `scripts/replace_projects_root.sh --dry-run` to see which files will be modified.
6. If happy, run `scripts/replace_projects_root.sh` to perform the replacements. Backups will be saved next to modified files with a `.bak` suffix.

Next steps (after replacing):

- Run `terraform init && terraform plan` inside a single environment (e.g. `environments/prod-docker`) to verify HCL syntactic validity.
- If all good, commit replacements and open a PR for review.
