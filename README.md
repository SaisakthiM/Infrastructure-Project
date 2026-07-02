<div align="center">

# ⬡ Infrastructure-Project

**A production-style personal development cluster — 10 full-stack applications behind a single Nginx gateway, provisioned with Terraform + Terragrunt, orchestrated across Docker and Kubernetes, with GitOps via ArgoCD and PR automation via Atlantis.**

[![Release](https://img.shields.io/github/v/release/SaisakthiM/Infrastruture-Project?style=flat-square&color=00cfcf)](https://github.com/SaisakthiM/Infrastruture-Project/releases/latest)
[![License](https://img.shields.io/github/license/SaisakthiM/Infrastruture-Project?style=flat-square&color=3fb950)](LICENSE)
[![Go](https://img.shields.io/badge/CLI-Go-00ADD8?style=flat-square&logo=go)](infra-cli/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?style=flat-square&logo=terraform)](environments/)
[![ArgoCD](https://img.shields.io/badge/GitOps-ArgoCD-EF7B4D?style=flat-square&logo=argo)](gitops/)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Applications](#-applications)
- [Tech Stack](#-tech-stack)
- [Infrastructure Layout](#-infrastructure-layout)
- [CLI Tool](#-cli-tool--social-platform)
- [Getting Started](#-getting-started)
- [Routing Map](#-routing-map)
- [Project Structure](#-project-structure)
- [FAQ](#-faq)
- [Lessons Learned](#-lessons-learned)

---

## 🗺 Overview

A **personal infrastructure project** — a collection of independently built, production-grade full-stack applications unified under a single Nginx reverse proxy. Every app is containerized. Infrastructure is managed as code with Terraform/Terragrunt across five purpose-scoped environments. Kubernetes-side resources are GitOps-reconciled by ArgoCD. The entire cluster is controlled by a single Go CLI binary.

| | |
|---|---|
| **Applications** | 10 full-stack projects |
| **Backend Languages** | Python · Java · Go · Rust · Node.js |
| **Frontend** | React + Vite |
| **Databases** | PostgreSQL · MySQL · SQLite · Redis · Cassandra |
| **Message Broker** | Kafka |
| **Object Storage** | MinIO (S3-compatible) |
| **Containers** | Docker |
| **Orchestration** | Kubernetes via `kind` |
| **IaC** | Terraform + Terragrunt (5 environments) |
| **GitOps** | ArgoCD |
| **PR Automation** | Atlantis |
| **CI/CD** | Jenkins |
| **Gateway** | Nginx |
| **AI / LLM** | Google Gemini API · Ollama |
| **Live Domain** | [saisakthi.qzz.io](https://saisakthi.qzz.io) via Cloudflare Tunnel |

---

## 🏗 Architecture

```
                        ┌──────────────────────────────────────┐
                        │       Nginx Gateway  :80 / :443       │
                        │   Let's Encrypt SSL — Single Entry     │
                        └──────────────────┬───────────────────┘
                                           │
       ┌───────────────────────────────────┼───────────────────────────────┐
       │                                   │                               │
 ┌─────▼──────┐                    ┌───────▼──────┐               ┌───────▼──────┐
 │  /notes/   │                    │   /bank/     │               │   /quiz/      │
 │  Django    │                    │ Spring Boot  │               │ React static  │
 │ PostgreSQL │                    │ PostgreSQL   │               └──────────────┘
 └────────────┘                    └──────────────┘
 ┌────────────┐                    ┌──────────────┐               ┌──────────────┐
 │  /video/   │                    │  /hospital/  │               │   /blog/     │
 │  Node.js   │                    │   Django     │               │   Django     │
 └────────────┘                    │   SQLite     │               │ MySQL+MinIO  │
                                   └──────────────┘               └──────────────┘
 ┌────────────┐                    ┌──────────────┐               ┌──────────────┐
 │/api-service│                    │  /document/  │               │  /whisper/   │
 │  Node.js   │                    │   Django     │               │  Rust+Axum   │
 │  Express   │                    │ MySQL+MinIO  │               │  PG+MinIO    │
 └────────────┘                    │ Gemini+Ollama│               │  WebSocket   │
                                   └──────────────┘               └──────────────┘

                          /social/ — kind cluster (ArgoCD-managed)
          ┌──────────────────────────────────────────────────────────┐
          │  Django · Go MS · Java MS (Kafka+Cassandra) · React       │
          │  PostgreSQL · Redis · Kafka · Cassandra · MinIO           │
          │  ingress-nginx · kube-prometheus-stack (Helm via ArgoCD)  │
          └──────────────────────────────────────────────────────────┘

                    Observability — kind cluster, ArgoCD-managed
          ┌──────────────────────────────────────────────────────────┐
          │  Prometheus · Grafana · Loki · Tempo · Promtail           │
          │  Jaeger · OpenTelemetry Collector                         │
          └──────────────────────────────────────────────────────────┘

                       Platform tooling — gateway-net
          ┌──────────────────────────────────────────────────────────┐
          │     Jenkins (CI/CD)  ·  Atlantis (PR apply)  ·  n8n      │
          └──────────────────────────────────────────────────────────┘
```

All Docker containers share the `gateway-net` bridge network. The Social Media App and observability stack run inside a `kind` Kubernetes cluster, reconciled by ArgoCD. The gateway container is connected to both networks via the `prod-manage` environment, so `/social/` and `/grafana/` traffic proxies seamlessly into the cluster.

![Cluster intro page](images/image-intro.png)

---

## 📦 Applications

### 1 — Notes App
| | |
|---|---|
| **Stack** | Django · React + Vite · PostgreSQL 16 |
| **URL** | `/notes/` |

![Notes App](images/image-notes.png)

Create, read, update, and delete notes via a Django REST Framework API backed by PostgreSQL.

---

### 2 — Bank Manager
| | |
|---|---|
| **Stack** | Spring Boot (Java) · React + Vite · PostgreSQL 16 Alpine |
| **URL** | `/bank/` |

![Bank Manager](images/image-bank.png)

Account and transaction management with Spring Data JPA, Spring MVC REST API, and a React frontend.

---

### 3 — Quiz App
| | |
|---|---|
| **Stack** | React + Vite (fully static) |
| **URL** | `/quiz/` |

![Quiz App](images/image-quiz.png)

A client-side CS trivia quiz — no backend, no database. Nginx serves the compiled static bundle directly.

---

### 4 — Video Uploader
| | |
|---|---|
| **Stack** | Node.js · React + Vite |
| **URL** | `/video/` |

![Video Uploader](images/image-video.png)

Upload and stream video files via Node.js. The gateway allows up to 1 GB uploads.

---

### 5 — Blog Website
| | |
|---|---|
| **Stack** | Django · MySQL 8.0 · MinIO |
| **URL** | `/blog/` |

![Blog Website](images/image-blog.png)

Full-featured blog with Django auth, rich post creation, image uploads to MinIO, and an admin panel at `/blog/admin/`.

---

### 6 — Hospital Management
| | |
|---|---|
| **Stack** | Django · SQLite |
| **URL** | `/hospital/` |

![Hospital Management](images/image-hospital.png)

Patient and appointment tracking with Django admin and template-based views. Lightweight — no separate DB container.

---

### 7 — API Service
| | |
|---|---|
| **Stack** | Node.js + Express · React + Vite · OpenWeatherMap API |
| **URL** | `/api-service/` |

![API Service](images/image-api.png)

Live weather data fetched via OpenWeatherMap, served through Express routes with an interactive React frontend.

---

### 8 — Document Intelligence Platform
| | |
|---|---|
| **Stack** | Django · React + Vite · MySQL 8.0 · MinIO · Gemini API · Ollama |
| **URL** | `/document/` |

![Document Intelligence Platform](images/image-document.png)

Upload PDFs to MinIO and run AI-powered Q&A against them via Google Gemini or local Ollama inference. Gateway timeout extended to 120 s for large inference requests.

---

### 9 — Whisper (Real-time Chat)
| | |
|---|---|
| **Stack** | Rust (Axum) · React + Vite · PostgreSQL 15 · MinIO · JWT · WebSocket |
| **URL** | `/whisper/` |

![Whisper](images/image-whisper.png)

WhatsApp-style real-time chat. Axum handles WebSocket messaging, JWT auth, and media uploads to MinIO. React talks to it over `/whisper/api/` and `/whisper/ws/`.

---

### 10 — Social Media App
| | |
|---|---|
| **Stack** | Django · Go MS · Java MS (Kafka + Cassandra) · React · PostgreSQL 15 · Redis · MinIO |
| **Orchestration** | Kubernetes (`kind`) — fully ArgoCD-managed |
| **URL** | `/social/` |

![Social Media App](images/image-social.png)

The most complex project — a microservices platform on a Kubernetes cluster. Every Kubernetes object (Postgres, Redis, Kafka, Cassandra, MinIO, the Go/Java microservices, Django/React deployments, ingress-nginx) is plain YAML under `gitops/social-media/`, synced by ArgoCD rather than applied by Terraform. The gateway bridges to the `kind` network so `/social/` traffic proxies into the cluster's NodePort.

> The full observability stack (Prometheus, Grafana, Loki, Tempo, Promtail, Jaeger, OTel Collector) is live and reachable at `/grafana/`, `/jaeger/`, and `/otel/`.

---

## 🛠 Tech Stack

| Language | Used in |
|----------|---------|
| Python | Notes, Blog, Hospital, Document, Social (Django) |
| Java | Bank Manager (Spring Boot), Social (Java microservice) |
| Go | Social Media (Go microservice), CLI tool |
| Rust | Whisper (Axum backend) |
| JavaScript / Node.js | API Service, Video Uploader |
| TypeScript / React + Vite | All frontends |

| Database | Used by |
|----------|---------|
| PostgreSQL 16 | Notes App, Bank Manager |
| PostgreSQL 15 | Whisper, Social Media (K8s StatefulSet) |
| MySQL 8.0 | Blog Website, Document Intelligence Platform |
| SQLite | Hospital Management |
| Redis 7 | Social Media (caching layer, K8s) |
| Cassandra 5.0 | Social Media (Java microservice, K8s StatefulSet) |
| Kafka | Social Media (Java microservice messaging, K8s) |

| Tool | Purpose |
|------|---------|
| Docker | Containerization of all services |
| Terraform | Images, containers, volumes, ArgoCD bootstrap, K8s Secrets |
| Terragrunt | Five dependency-ordered environments, per-env local backends |
| Atlantis | PR-based `plan`/`apply` — gated on approved + mergeable |
| Kubernetes (`kind`) | Local cluster for Social Media App + observability |
| ArgoCD | GitOps sync of all K8s YAML — replaces `kubectl_manifest`/`helm_release` |
| Nginx | API Gateway — single entry point for all apps |
| MinIO | S3-compatible object storage |
| Jenkins | Self-hosted CI/CD, git-diff-based selective build pipeline |
| n8n | Self-hosted workflow automation |
| Gemini API | Document Q&A |
| Ollama | Local LLM inference |
| Cloudflare Tunnel | Expose cluster at `saisakthi.qzz.io` without opening ports |

---

## ⚙ Infrastructure Layout

### Five Environments

```
environments/
  terragrunt.hcl         # root — generates a local backend per environment
  prod-gateway/          # gateway-net network + Nginx, zero dependencies
  prod-social/           # kind cluster, ArgoCD install, social-media images/Secrets
  prod-docker/           # every non-k8s app (notes, bank, quiz, video, whisper, …)
  prod-infra/            # otel-gateway, node-exporter, n8n, Jenkins, observability app-of-apps
  prod-manage/           # one glue resource: connects gateway container to the kind network
```

### Apply Order

`prod-gateway` and `prod-social` have no dependencies and apply in parallel. Everything else waits on one or both:

```
prod-gateway ─┬─→ prod-docker
              ├─→ prod-infra ←─ prod-social
              └─→ prod-manage ←─ prod-social
```

Terragrunt reads each environment's `dependencies` block and enforces this order automatically:

```bash
cd environments/
terragrunt run --all apply
```

### ArgoCD — Kubernetes GitOps

Everything that was `kubectl_manifest` or `helm_release` inside Terraform now lives as plain YAML under `gitops/`, synced by ArgoCD:

- `gitops/social-media/{raw,apps}/` — Postgres, Redis, Kafka, Cassandra, MinIO, Go/Java microservices, Django/React, ingress-nginx.
- `gitops/observability/{raw,apps}/` — kube-prometheus-stack, Loki, Tempo, Promtail, Jaeger, OTel Collector, observability Redis.

`prod-social` and `prod-infra` each create exactly one Terraform-managed "app-of-apps" `Application` pointing at one of those folders. Terraform's Kubernetes job shrank to: bootstrap the cluster, install ArgoCD, create the Secrets that shouldn't be in git, and create that single pointer object.

### Smart Rebuild Triggers

Docker images only rebuild when source code actually changes, using a directory content hash:

```hcl
triggers = {
  dir_sha = sha256(join("", [
    for f in fileset(path.module, "**") :
    filesha256("${f}")
    if !can(regex("(__pycache__|node_modules|dist|target|\\.git)", f))
  ]))
}
```

### Atlantis — PR-gated Applies

Each environment is its own Atlantis project. Changes auto-plan on PR. Apply requires `approved` + `mergeable`. `parallel_apply` is disabled — apply order matters, so Atlantis applies one project at a time in the order above.

### Jenkins — Smart CI/CD

A dockerized Jenkins instance uses `git diff` to detect changed apps and selectively test/build/deploy only what moved, grouped into sequential parallel stages (Django → Node/React → Java/Maven).

---

## 💻 CLI Tool — `social-platform`

A single-binary Go CLI that installs prerequisites, configures secrets, downloads infrastructure files, and drives Terragrunt — all without needing to touch terraform directly.

### Install

```bash
# Linux amd64
curl -Lo social-platform \
  https://github.com/SaisakthiM/Infrastruture-Project/releases/latest/download/social-platform-linux-amd64
chmod +x social-platform && sudo mv social-platform /usr/local/bin/

# Web UI (browser dashboard)
curl -Lo social-platform-webui \
  https://github.com/SaisakthiM/Infrastruture-Project/releases/latest/download/social-platform-webui-linux-amd64
chmod +x social-platform-webui
```

### Commands

```bash
social-platform install                          # check prerequisites + download infra
social-platform configure                        # prompt for secrets → write terraform.tfvars
social-platform deploy                           # terragrunt run --all apply
social-platform deploy --env prod-docker         # deploy a single environment
social-platform deploy --env prod-docker \
  --target docker_container.blog_db              # target a specific resource
social-platform destroy --env prod-docker        # destroy a single environment
social-platform status --env prod-docker         # terragrunt plan (show pending changes)
social-platform import-state                     # auto-detect + import Docker resources into state
social-platform ui                               # launch interactive Bubble Tea TUI
social-platform-webui                            # launch browser dashboard (http://localhost:8080)
```

### Web UI

```bash
social-platform-webui           # http://localhost:8080
social-platform-webui --port 9090
```

Provides a dark-theme browser dashboard with live SSE-streamed command output, environment selector, and a Docker state import panel.

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker | latest | https://docs.docker.com/desktop/ |
| Terraform | ≥ 1.6 | https://developer.hashicorp.com/terraform/install |
| Terragrunt | ≥ 0.59 | https://terragrunt.gruntwork.io/docs/getting-started/install/ |
| `kind` | ≥ 0.20 | https://kind.sigs.k8s.io/docs/user/quick-start/ |
| `kubectl` | latest | https://kubernetes.io/docs/tasks/tools/ |
| ArgoCD CLI | latest | https://argo-cd.readthedocs.io/en/stable/cli_installation/ |

### Option A — Using the CLI (recommended)

```bash
# Install the CLI
curl -Lo social-platform \
  https://github.com/SaisakthiM/Infrastruture-Project/releases/latest/download/social-platform-linux-amd64
chmod +x social-platform && sudo mv social-platform /usr/local/bin/

# Install prerequisites + download infra
social-platform install

# Configure secrets (stores in OS keychain, writes terraform.tfvars)
social-platform configure

# Deploy everything
social-platform deploy
```

### Option B — Manual

```bash
git clone https://github.com/SaisakthiM/Infrastruture-Project.git
cd Infrastruture-Project/environments

# Before first apply — update gitops_repo_url in:
#   environments/prod-social/terraform.tfvars
#   environments/prod-infra/terraform.tfvars
#   gitops/social-media/apps/social-workload-app.yaml
#   gitops/observability/apps/*.yaml
# Replace git@github.com:SaisakthiM/Coding-Project.git with your actual repo URL.

terragrunt run --all apply
```

All apps will be live at `http://localhost/<app>/` once provisioned.

### Tear Down

```bash
social-platform destroy        # all environments
# or
cd environments && terragrunt run --all destroy
```

---

## 🗺 Routing Map

| URL | App | Backend |
|-----|-----|---------|
| `/intro/` | Intro Page | Static |
| `/notes/` | Notes App | `notes-backend:8000` |
| `/bank/` | Bank Manager | `bank-backend:8080` |
| `/quiz/` | Quiz App | Static |
| `/video/` | Video Uploader | `video-uploader-backend:8080` |
| `/hospital/` | Hospital Management | `hospital-management:8000` |
| `/blog/` | Blog Website | `blog-website:8000` |
| `/api-service/` | API Service | `api-service-backend:8000` |
| `/document/` | Document Platform | `doc-backend:8000` |
| `/whisper/` | Whisper Chat | `whisper_backend:8000` |
| `/whisper/ws/` | Whisper WebSocket | `whisper_backend:8000 → /ws/` |
| `/social/` | Social Media App | `kind` → ingress-nginx NodePort |
| `/grafana/` | Grafana dashboards | `kind` → Grafana pod |
| `/jaeger/` | Distributed tracing | `kind` → Jaeger pod |
| `/otel/` | OTLP ingest | `kind` → OTel Collector |
| `/argocd/` | ArgoCD UI | `kind` → ArgoCD server |
| `/jenkins/` | Jenkins CI/CD | `jenkins:8080` |
| `/n8n/` | n8n automation | `n8n:5678` |

### Health Check

```bash
curl http://localhost/
# {"status":"gateway running","apps":["/notes/","/bank/","/quiz/","/video/",...]}
```

---

## 📁 Project Structure

```
Infrastruture-Project/
│
├── environments/                  # Terragrunt environments
│   ├── terragrunt.hcl             # root — per-env local backend
│   ├── prod-gateway/              # gateway-net network + Nginx
│   │   └── nginx/default.conf     # all routing lives here
│   ├── prod-docker/               # all non-k8s app containers + volumes
│   ├── prod-social/               # kind cluster, ArgoCD, social-media images/Secrets
│   ├── prod-infra/                # n8n, Jenkins, node-exporter, observability app-of-apps
│   └── prod-manage/               # gateway ↔ kind network glue
│
├── modules/
│   ├── docker_app/                # shared docker_container + network module
│   └── networking/                # wraps docker_network
│
├── gitops/
│   ├── social-media/
│   │   ├── raw/                   # extracted K8s manifests (Postgres, Redis, Kafka, …)
│   │   └── apps/                  # ArgoCD Applications (ingress-nginx, social-workload)
│   └── observability/
│       ├── raw/                   # OTel NodePort, Jaeger config, ingresses
│       └── apps/                  # ArgoCD Applications (prometheus, loki, tempo, jaeger, …)
│
├── images/                        # screenshots for README
│   ├── image-intro.png
│   ├── image-notes.png
│   ├── image-bank.png
│   ├── image-quiz.png
│   ├── image-video.png
│   ├── image-blog.png
│   ├── image-hospital.png
│   ├── image-api.png
│   ├── image-document.png
│   ├── image-social.png
│   └── image-whisper.png
│
├── infra-cli/                     # Go CLI source
│   ├── cmd/                       # Cobra commands
│   ├── internal/
│   │   ├── config/                # Viper config + auto-migration
│   │   ├── deploy/                # Terragrunt wrapper + Docker state import
│   │   ├── tui/                   # Bubble Tea TUI
│   │   ├── secrets/               # OS keychain + tfvars generation
│   │   └── release/               # GitHub release download + extraction
│   └── webui/                     # Web UI server + embedded HTML
│
├── projects/
│   ├── Notes App/                 # Django + React
│   ├── Bank Manager/              # Spring Boot + React
│   ├── Quiz App/                  # React (static)
│   ├── Video Uploader/            # Node.js + React
│   ├── Blog Website/              # Django + MySQL + MinIO
│   ├── hospital_management/       # Django + SQLite
│   ├── API Service/               # Express + React
│   ├── Document Intelligence Platform/ # Django + MySQL + MinIO + Gemini
│   ├── Social Media App/          # Django + Go MS + Java MS + React (K8s)
│   └── Whatsapp/                  # Rust/Axum + React (Whisper)
│
├── atlantis.yaml                  # PR-based plan/apply config
└── README.md
```

---

## ❓ FAQ

**Q: Why Terraform instead of Docker Compose?**

As the project scaled from 2 apps to 9, Docker Compose became impossible to maintain — databases, frontends, backends, networks, and volumes all in one monolithic file. Terraform gives each concern its own resource with explicit dependencies, state tracking, and lifecycle management. When something breaks, you know exactly what changed.

**Q: Why ArgoCD for Kubernetes instead of `helm install` or `kubectl apply`?**

Self-healing. If a pod crashes or a manifest drifts, ArgoCD reconciles it back automatically. With Compose or manual kubectl, I'd have to notice the failure, rebuild, and reapply manually. The tradeoff: no automated tests on changes yet, so breaking changes require a rollback. Worth it for the operational simplicity.

**Q: Why a separate database instance per app instead of one shared Postgres?**

Isolation over storage efficiency. If a shared Postgres goes down, every app goes down with it. With separate instances, a failure in the Blog's MySQL doesn't affect Notes or Bank. The extra disk usage is the explicit tradeoff for fault isolation.

**Q: Why Kubernetes (`kind`) for the Social Media App?**

The social media app is genuinely microservices — Django backend, Go microservice, Java microservice (Cassandra + Kafka), React frontend, all with different scaling and failure characteristics. Kubernetes gives self-healing, rolling updates, service discovery, and resource limits that Docker Compose can't match at that complexity level.

**Q: Why Kafka?**

The Java microservice uses it for the notification subsystem — an event-driven pattern where producers publish user events and consumers fan them out to recipients. Overkill for the scale, but the goal was to build something architecturally realistic, not minimal.

**Q: How is this exposed publicly?**

Via Cloudflare Tunnel. No ports opened on the router — the tunnel binary runs as a container, connects outbound to Cloudflare's edge, and traffic arrives at `saisakthi.qzz.io`. Free subdomain from `qzz.io` via DigitalPlat, NS delegated to Cloudflare.

---

## 📖 Lessons Learned

**Persistence beats cleverness.** There will be 12-hour sessions staring at a URL mismatch in the proxy config or a certificate error that turns out to be one wrong character in `nginx.conf`. The only way through is not around.

**Integration errors are different from code errors.** Individual projects worked fine in isolation. The moment they got wired together behind a reverse proxy, error cascades appeared that no amount of unit testing would have caught. The lesson: think in systems from day one, not just in code.

**Documentation is painful to write and essential to have.** Future-me staring at a 3,000-line `main.tf` with no comments is exactly why this README exists. Sorry, future me.

**The world doesn't stop for your project.** Terraform provider breaking changes, Terragrunt CLI restructuring, ArgoCD API updates, Docker socket permission models — every dependency updates on its own schedule. Being error-tolerant isn't a personality trait, it's a required skill.

**Infrastructure is the hardest part to test.** `terraform plan` lies sometimes. ArgoCD shows healthy when the app is actually broken. The only real test is applying to a real environment and watching what happens.

---

## 🔒 Security Notes

- Real credentials (Postgres passwords, MinIO credentials, Redis passwords, API keys) are stored in the OS keychain by the CLI and written to `terraform.tfvars` files which are **never committed to git**.
- Kubernetes Secrets for the social media app and observability stack are created directly by Terraform, not stored in any git-tracked file.
- The Atlantis GitHub token and webhook secret are similarly stored in the keychain only.
- The Terraform backend is `local` and paths default to `/home/saisakthi/`. For a different machine change `infra_dir` in `~/.social-platform/config.yaml` or re-run `social-platform install`.

---

<div align="center">

Built by **Saisakthi M** &nbsp;·&nbsp; Chennai, India &nbsp;·&nbsp; [saisakthi.qzz.io](https://saisakthi.qzz.io)

*Runs locally and in production via Cloudflare Tunnel*

</div>
