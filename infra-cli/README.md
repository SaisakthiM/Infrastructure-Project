# social-platform CLI

A single-binary CLI for deploying and managing the social-platform
infrastructure project. Wraps Terraform/Terragrunt with secret management,
auto-install of prerequisites, and GitHub Releases distribution.

## Quick Start

```bash
# 1. Download the binary for your platform from GitHub Releases:
curl -Lo social-platform \
  https://github.com/SaisakthiM/Infrastruture-Project/releases/latest/download/social-platform-linux-amd64
chmod +x social-platform && sudo mv social-platform /usr/local/bin/

# 2. Install prerequisites + download infra files
social-platform install

# 3. Configure secrets and generate terraform.tfvars
social-platform configure

# 4. Deploy everything
social-platform deploy
```

## Commands

| Command | Description |
|---|---|
| `install` | Check/install prerequisites, choose and download an infra release |
| `configure` | Set secrets (OS keychain) + config, write terraform.tfvars |
| `deploy [--env ENV]` | Run `terragrunt run-all apply` (or single env) |
| `destroy [--env ENV]` | Run `terragrunt run-all destroy` |
| `status [--env ENV]` | Run `terragrunt plan` to show pending changes |
| `logs [--env ENV]` | Stream debug-level terragrunt output |

### Environment names for `--env`
`all` · `prod-gateway` · `prod-docker` · `prod-social` · `prod-infra` · `prod-manage`

### Deploy flags
```
--env string          Environment to target (default "all")
--auto-approve        Skip interactive confirmation
```

## Architecture

```
cli/
├── main.go
├── cmd/
│   ├── root.go          # Cobra root, Execute()
│   ├── install.go       # install command
│   ├── configure.go     # configure command
│   ├── deploy.go        # deploy command
│   └── ops.go           # destroy / status / logs commands
└── internal/
    ├── ui/              # colored output, prompts, spinner
    ├── config/          # Viper-backed config (~/.social-platform/config.yaml)
    ├── secrets/         # OS keychain read/write + tfvars generation
    ├── release/         # GitHub API + download/extract infra tarball
    ├── checker/         # prerequisite detection + auto-install
    └── deploy/          # terragrunt wrapper with live streaming
```

## Secret Storage

Secrets are stored in your **OS keychain** (macOS Keychain, Linux
`secret-service`/`kwallet`, Windows Credential Manager) via
[go-keyring](https://github.com/zalando/go-keyring).

Nothing sensitive is written to `~/.social-platform/config.yaml`.
The `terraform.tfvars` files are written to disk only inside the infra
directory (not committed — `.gitignore` excludes them).

## Build from Source

```bash
cd cli
go mod tidy
make build          # current platform
make build-all      # all platforms → dist/
make install        # build + install to /usr/local/bin
```

## Publishing a Release

```bash
make release VERSION=v1.2.3
```

This tags the commit and pushes it. GitHub Actions (`.github/workflows/release.yml`)
then builds all platform binaries and creates a GitHub Release with:
- `social-platform-linux-amd64`
- `social-platform-linux-arm64`
- `social-platform-darwin-amd64`
- `social-platform-darwin-arm64`
- `social-platform-windows-amd64.exe`
- `infra.tar.gz` (infra/ directory, no state/secrets)
- `SHA256SUMS`

## Infra Deploy Order

Terragrunt dependency blocks enforce this order automatically:

```
prod-gateway   → foundation (docker network + nginx)
prod-docker    → depends on: prod-gateway
prod-social    → depends on: prod-gateway  (kind cluster + ArgoCD)
prod-infra     → depends on: prod-gateway, prod-social
prod-manage    → depends on: prod-gateway, prod-social
```
