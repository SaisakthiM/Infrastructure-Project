# Mini City: agent instructions

## 1. The goal
Turn my existing infrastructure project (saisakthi.qzz.io) into a "mini city". The home page becomes a first-person 3D world (three.js). Each building is a district that opens an existing service as a 2D panel floating over a blurred 3D background. Services are NOT being rewritten in 3D; only the home page is rebuilt, plus shared city logic (one login, one currency, safe mode) layered over the services.

## 2. The old project (what exists today)
A large personal infra project with ~9 full-stack apps, hosted at saisakthi.qzz.io.

- **Apps:** Bank Manager (Spring Boot), Hospital Management (Django), Blog Website, Social Media App (Kubernetes, Go + Java microservices, Cassandra, Kafka), Video Uploader, API Service, Document Intelligence Platform, Notes App, Quiz App.
- **Home page:** raw HTML with a terminal-aesthetic dark theme (portfolio). This is what the 3D home replaces.
- **Infra:** Terraform/Terragrunt multi-environment (prod-gateway, prod-docker, prod-social, prod-infra, prod-manage), Docker, Kubernetes (kind), ArgoCD GitOps, Atlantis PR automation, Jenkins CI/CD for the monorepo.
- **Observability:** OpenTelemetry with Loki, Tempo, Grafana, Jaeger, otel-collector (spanmetrics).
- **Networking:** Cloudflare Tunnel, DigitalPlat free subdomain, Cloudflare Origin Certificates. Some frontends are served under nginx subpaths (Vite base-path fixes were needed). Check how each app is routed before choosing its `url` in `districts.json`.
- **Known state (do not "fix" these as a side effect of city work):**
  - Bank API currently permits all requests (no auth) and its CORS allows everyone. Fixing this is planned separately.
  - Hospital and Document apps have no auth system. The video uploader is intentionally anonymous.
  - compiler-server is currently broken and is being fixed separately.
  - Several frontends are Figma Make exports with scaffolding quirks; check `package.json` before assuming a normal Vite setup.

## 3. The city design (from my sketch)
**Idea:** connect the apps into one ecosystem with dependencies and fallbacks. All 9 projects stay, with some additional ones added. Quiz App and Notes App are dropped (they don't fit the city model and can't be reused).

**Money is everything.** You spend and earn in the city, and everything costs something.
- **Earn (2 ways):** (1) Work: as a doctor, grocery store worker, or barista. (2) Influencer: money depends on how engaging your videos are and how many followers you have.
- **Spend:** healthcare and groceries, plus weather, cloud services and AI insights.

**Per-district plan and difficulty**
- **Hospital Management (medium):** add earning/spending logic for doctors and patient appointments (what patients pay, what a doctor earns). Collect these metrics, connect them to MinIO and do analytics.
- **Blog + Social Media (easy):** earnings from how engaging blogs and posts are. Collect the metrics for both.
- **Bank Management (most important):** must be available at all times. If the bank is down the city falls into **safe mode**: you can spend money you already have, but only on one service (not many, which would create state conflicts on money). Earning in safe mode: you can earn on one service (like posting); these writes go to a read-after-write database, and when the bank comes back online it takes them and adds them to the credits. Earned money is not updated in the balance during safe mode.
- **API Service, Video Storage, Document Upload (hard):** change things from the core. The API needs more services and should be split. Video storage: scrap its UI and add a new UI with additional endpoints and logic. Document upload: add a download section for documents, and add an AI chatbot as therapist support.
- **Whisper:** added to the ecosystem as the city's chatting app, using websockets. (Notes and Quiz apps are dropped.)
- **Monitoring and Metrics = the city's police:** alerts when the city is spiking or breaking, and shuts things down if so. Hard part: the Docker metrics are connected, but the Docker data must be segregated to see which services spike, and a pipeline must be added to kill them.

**Rollout order (my plan)**
1. Create a new branch.
2. Rebuild the home page core: an interactive 3D city website, navigated through sub-domains, plus a service that keeps the sync of all working services and pushes updates to the website.
3. Start the new projects: a grocery store and a housing system. Housing is just a checkpoint: nothing big and grand, a normal home.
4. Before step 3: add project-wide user logic and remove authentication from the rest of the apps, so users log in at home and then use the services. Only the bank needs an extra PIN.

## 4. Current implementation (this folder)
- `index.html`: scene, first-person controls, collision, HUD, overlay panel, status handling.
- `districts.json`: spawn point, optional `statusUrl`, and the districts (`id`, `name`, `url`, `pos` [x,z], `size` [w,h,d], `color`, `statusKey`).
- `stub.html`: placeholder service page for local testing. It posts `city:balance` and `city:close` to the parent.

## 5. Hard rules
- Raw HTML + ES modules + three.js from an import map. No React, no bundler, no new frameworks unless I ask.
- Work on branch `mini-city`. One small task per commit. Never commit to main.
- Never read, print or commit secrets (.env, tokens, keys, cookies).
- Do not change security-sensitive code without asking first and explaining the change: the `postMessage` origin check, cookie settings, CSP / `frame-ancestors`, anything touching auth or the bank.
- Do not touch the other apps' code unless the task says so. The city layer sits on top of them.
- Prefer editing data in `districts.json` over editing logic in `index.html`.
- Give complete files when I ask for a file, not partial diffs. Prefer direct shell commands over long explanations.
- If a task is unclear, ask one question instead of guessing.

## 6. Run and test
```bash
python3 -m http.server 8080      # then open http://localhost:8080/?debug
```
`?debug` enables `K` to toggle the bank between up and down, to check the safe-mode visuals.
After every change: walk (WASD), collide with a building, press E near it, the panel opens, Esc closes it, browser back works, and `#/bank` deep-links to the bank.

## 7. Contracts
- **Status:** `statusUrl` returns JSON like `{"bank":"up","hospital":"down"}`. A missing key means up. A down service renders as a dark building and the panel shows the safe-mode message instead of the iframe.
- **Panel to city messages** (`window.parent.postMessage`): `{type:"city:close"}` closes the panel; `{type:"city:balance", balance:<number>}` updates the HUD balance. The city accepts messages only from origins listed in `districts.json`.
- **Money (design target, not built yet):** the bank is the only writer of balances. Other services send earn/spend events with a unique event ID, so replays after safe mode can never double-pay.

## 8. Task queue (do in order, one per commit)
1. Add `housing` to `districts.json` (x=0, z=-62, size [14,6,10], color #b08968). Data only.
2. Add a simple road: a dark grey plane strip along z from 30 to -60, width 6, in `index.html`.
3. Add a small minimap in the HUD (2D canvas, top-left, buildings as dots, player as an arrow).
4. Replace the box for one district with a low-poly glTF model via `GLTFLoader`, keeping the box as fallback if loading fails.
5. Add touch controls (virtual joystick plus drag to look) and a 2D fallback link list when WebGL is unavailable.
6. Wire a real `statusUrl` once the status sync service exists.

## 9. Owner-driven later (do not start unless asked)
- Project-wide login at home and removal of per-app auth (auth cookie on the parent domain or a shared session, checked by every service).
- `frame-ancestors` headers on each service so only the home origin can embed it.
- Bank PIN, safe-mode ledger replay, earning/spending events between services.
- Metrics pipeline for the police district (segregate Docker data, spike detection, kill pipeline).

## 10. Definition of done
Runs from the command above with no console errors, behavior tested as listed, commit message states what changed and why.