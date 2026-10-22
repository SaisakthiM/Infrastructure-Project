# Mini City: agent instructions

## 1. The goal
Turn my infrastructure project (saisakthi.qzz.io) into a "mini city": a walkable first-person 3D home where every deployed service is a building on one street. The services are NOT rewritten in 3D. Only the home is a 3D world; each building opens its own service page, and the city layer (one bank login, one balance, safe mode, one visual theme) sits on top of every app.

## 2. The repo today
Three folders matter: `projects/` (deployable source), `environments/` (Terragrunt/Terraform deploy definitions), `infra-cli/` (my Go CLI that drives deploys). It is a git repo; I work on branch `mini-city`.

- **The twelve wards** (see §4 for the registry table): Bank Manager (Spring Boot + PostgreSQL + JWT), Hospital (Django), Grocery (Django), Housing (Django), Inkwell/Blog (Django + MySQL + MinIO), Social (Go + Java microservices, Cassandra, Kafka, Consul), Video & File Storage (Spring Boot + MinIO), API & Markets (Express), Documents (Python RAG + MinIO), Cloud Compiler (Node + Monaco + Docker sandbox), Whisper (Rust/Axum + WebSockets + React), Monitoring = the city police (Grafana, Prometheus, Loki, OTel).
- **Notes App and Quiz App**: code stays in `projects/`, they are removed from the deploy (no gateway routes, no Terraform resources).
- **Infra:** Terragrunt stacks `prod-gateway`, `prod-docker`, `prod-social`, `prod-infra`, `prod-manage`; Docker, kind, ArgoCD, Atlantis, Jenkins.
- **Networking:** Cloudflare Tunnel + DigitalPlat subdomain + CF origin certs. Frontends are served under nginx subpaths, so Vite `base` must match the route. Check routing in `environments/prod-gateway/nginx/default.conf` before changing any district's `link`.
- **Known state — do not "fix" these as a side effect of other work:**
  - Bank API is reachable and its CORS is broad; localhost is already allowed in `WebConfig.java` and `SecurityConfig` does enforce auth. Hardening is planned separately.
  - Hospital and Documents have no auth of their own; the video uploader is anonymous on purpose.
  - `compiler-server` (the D-10 backend) is live again: `docker_image.compiler_db` / `compiler_server`, `docker_container.compiler_db` and `module.compiler_server` sit in `environments/prod-docker/main.tf`, and both C++ services answer CORS from an allowlist (`Cors.hpp`) — any `localhost`/`127.x` port, `saisakthi.qzz.io`, plus `CORS_ALLOWED_ORIGINS`. Its nginx route still resolves at request time on purpose so a missing container cannot break the gateway.
  - Several frontends are Figma Make exports — read `package.json` before assuming a normal Vite setup.
  - The bank lets any logged-in user deposit any amount: the economy is trust-based, not tamper-proof, until the bank gets a server-side ledger.

## 3. The city design
**Money is everything.** Spend and earn in city rupees; everything costs something.
- **Earn (2 ways):** work (doctor, grocery shift, barista) and influencer (payout scales with engagement and followers).
- **Spend:** healthcare, groceries, weather/cloud/AI/API calls, rent.
- **Bank (D-01) is the load-bearing wall.** It must be available. If it is unreachable the city enters **Safe Mode**: you may keep spending what you already hold but only at one service, earnings queue locally, and the queue is applied when the bank answers again.
- Hospital: consultation fees and shift wages, metrics into MinIO for analytics. Blog/Social: creator earnings from reach. API/Video/Documents: core changes (API split, new video UI + endpoints, document download and a therapist chatbot). Police: segregate Docker metrics per service, spike alerts, and a pipeline that can stop the offender.
- **Rollout:** home 3D core → shared city layer and one login → grocery and housing → per-district money rules → police/metrics.

## 4. Current implementation
### Theme contract — read these first
- `projects/city-core/THEME.md` — **the paper registry**: the only place colours, codes and type are defined. `projects/city-core/README.md` — money, safe mode, gate, vault. `projects/city-core/SKIN.md` — theming an app we do not rebuild.
- Paper `#f4f2ed`, ink `#121212`, radius `0`, petrol accent `#0f6e9c`, Archivo (display = `wdth 80`, weight 500, `--disp-track -0.035em`) + JetBrains Mono for every label, code, amount and control caption. One muted accent per ward. The signature element is **the district plate** (ink code block + ward name + accent rule).
- The 3D world is daylight: matte pale bodies (`#e8e4da` / `#dcd6c9`), ink hairlines, coloured roof plates, overcast sky, linear fog `46 → 168` into `#e3dfd4`. Sanctioned dark surfaces: the video letterbox and the compiler editor/output only.

### The registry — three copies that must stay identical
`projects/intro/v3/src/data/projects.ts` (3D + home) · `projects/city-core/city-core.js` → `DISTRICTS` (HUD, accents, money keys) · `projects/city-core/THEME.md` §District registry (documentation).

| Code | service key | ward | link | position [x,z] |
|---|---|---|---|---|
| D-01 | `bank` | Bank Manager | `/bank/` | -32, -6 |
| D-02 | `hospital` | Hospital | `/hospital/` | 24, -6 |
| D-03 | `grocery` | Grocery | `/grocery/` | -28, -30 |
| D-04 | `housing` | Housing | `/housing/` | 24, -30 |
| D-05 | `blog` | Inkwell | `/blog/` | -22, -50 |
| D-06 | `social` | Social | `/social/` | 22, -50 |
| D-07 | `video` / `media` | Video & File Storage | `/video/` | -28, -70 |
| D-08 | `api` | API & Markets | `/api-service/` | 26, -70 |
| D-09 | `document` | Documents | `/document/` | -28, -90 |
| D-10 | `compiler` | Cloud Compiler | `/compiler/` | 26, -90 |
| D-11 | `whisper` | Whisper | `/whisper/` | -28, -110 |
| D-12 | `police` | Monitoring | `/grafana/` | 26, -110 |

`service` is the money-event identifier written into the bank ledger — **never rename one**, and never rename `media` (the Video district boots with it).

### The home — `projects/intro/v3` (React 19 + Vite + Tailwind v4 + three)
- `src/App.tsx` route switch: `/` → `pages/Home.tsx` (third-person robot portfolio world), `/city` → `pages/City.tsx` (first-person walkable street). `src/data/projects.ts` feeds both.
- `src/lib/scenery.ts` holds `MAQUETTE` (the palette above), `addDaylight()` and `createSignTexture()`; `src/lib/sfx.ts` Web Audio; `src/lib/router.tsx` History API + `Link`.
- `index.html` links `/city-core/city.css` (the home is printed from the same sheet as the districts) and loads `/city-core/city-entry.js`, which gates `/city` behind the bank sign-in.
- Walking up to a building shows the ward plate; **E** opens the ward record, and "Open <ward>" navigates to the service's own route. No iframe, no panel, no `postMessage` bridge — that was the old design.
- `?debug`, `districts.json` and `stub.html` are gone. The ward list lives in `projects.ts`, not in a fetched JSON.

### The shared layer — `projects/city-core` (static, no build step, served at `/city-core/`)
- `city-core.js` — bank client (`City.spend`, `City.earn`, `City.login`, `City.api`), one session per origin in `localStorage["city.session"]`, Safe Mode, HUD, login overlay, local vault.
- `city-app.js` — `startCityApp({ service, title, accent, scene, requireLogin, home, backdrop })`: loads `city.css`, mounts the HUD, gates the page, and puts the ward's themed 3D scene behind the UI. React/Vite apps call it through a variable import (`/city-core/city-app.js`) so the bundler leaves it alone; each app has a `src/city/startCity.*` shim.
- `city-scenes.js` + `city-3d.js` — the per-district backdrops and the three.js kit; `city-gate.js`/`city-gate.css` — one line that makes any page ask for the bank login first; `city-skin.js`/`city-skin.css` — 3D backdrop + paper theme for apps we don't rebuild; `vendor/three/` (r160, self-hosted), `models/`, `textures/`, `draco/`.
- Districts wired to the city layer: Bank, Blog, Documents, Compiler, Social, Whatsapp/Whisper, Hospital, Housing, Grocery, API Service, Video Uploader.

### Deploy wiring
- `environments/prod-gateway/nginx/default.conf` — the live route map for all twelve wards plus `/city-core/`.
- `environments/prod-gateway/main.tf` — owns `gateway-net` (`module.network` → `modules/networking`), nginx (`module.gateway`), `module.nginx_exporter`, and the intro / record / grocery / housing / city-core volumes. `null_resource.intro_page` builds `intro/v3` inside a node container and copies `dist` into `gateway_intro-dist`; triggers are content hashes, not timestamps.
- `environments/prod-docker/main.tf` + `shared-data.tf` — app images, containers (six `*_frontend_build` one-shots, the `shared-{postgres,mysql,minio}` trio + their init jobs, and nine `docker_app` modules) and the `*_dist` / `gateway_*` volumes.
- **`others.tf` — the parking lot.** Each environment has one, comment-only: resources and `variable` declarations taken out of the running deploy (prod-docker: superseded `docker_image` builds, Selenium — the compiler stack moved back to `main.tf`; prod-social: Consul, `smtp_*`; prod-infra: Grafana SMTP secret, Jenkins, Atlantis, the redis auth secret). Nothing there is referenced by live config — `depends_on` a commented block is a hard plan error — and a commented `variable` is invisible to `infra-cli`'s preflight, which is how the deploy stops asking for keys nothing uses. Re-enable by un-commenting the block *and* the declarations, then re-add the matching `import.go` entries; each file's header lists the steps.
- `environments/prod-infra/main.tf` — `null_resource.prod_social_ready` is the ordering gate: it refuses a prod-infra apply until the kind cluster answers `/readyz`, the `applications.argoproj.io` CRD exists, and both `argocd-application-controller` and `argocd-repo-server` have finished rolling out. `docker_container.otel_gateway` and `kubectl_manifest.app_of_apps_observability` both depend on it. In prod-social the same job is done inside the file: `kubectl_manifest.keda_interceptor_proxy` waits for `helm_release.argocd` (namespace `argocd` is created by that release), and the ArgoCD server Ingress waits for the release, the interceptor Service and the app-of-apps.
- `gitops/*/apps/` — the app-of-apps directories (`directory.recurse: false`, driven by the two `kubectl_manifest.app_of_apps_*` resources) must contain **only** `kind: Application` files. Values files, ConfigMaps and parked apps live in `gitops/observability/unsynced/` with a README that says why each one left and how to bring it back; a stray non-manifest there is a ComparisonError on the whole app-of-apps, which looks like "argocd not found" from the CLI.
- `infra-cli/internal/deploy/import.go` — the addresses `infra-cli import` may reference; keep it in step with the Terraform above or imports fail. Every terragrunt unit is an environment directory (app containers are `module "<name>"` calls inside that directory, not subdirectories), so scan and import always run from `environments/<env>` with the catalog address verbatim. The Helm/Kubernetes/kubectl probes read `--context kind-social-media`, the same context the providers pin.

### The deploy dashboard — `infra-cli/webui`
- Separate `//go:embed static` binary (`social-platform-webui`, `--port 9000`, binds all interfaces, no login) — it is mine, not the city's, and it is the one place outside `projects/` that carries the paper theme.
- `static/index.html` holds its own copy of the `THEME.md` §1 tokens (different origin, cannot load `/city-core/city.css`); `static/cluster3d.js` is the daylight maquette of the five stacks. Keep both in step with `THEME.md` — see its §5.
- `webui/secrets.go` + `internal/secrets/{secrets,filestore,extras}.go` — the **Secrets** sheet (`VAULT·01`): the whole keychain catalogue plus every declared variable still without a value, filed by **kind** and then by ward — `VAULT·K1` API keys you must obtain outside (each carries a hint: where to create it and which ward calls it), `VAULT·K2` private key files, `VAULT·K3` passwords the city issues. `SecretDef` carries `Class`/`App`/`Hint`; `ClassOf`/`AppOf`/`HintFor` infer the same for variables outside the catalogue. The browser only ever receives `set`/`written` booleans, never a stored value; blank means keep. `secrets.Delete` / `ClearExtra` are the clearing path, `SyncTfvars` refreshes the generated files.
- The two state-changing endpoints (`/api/secrets/save`, `/api/secrets/clear`) are wrapped in `guardDashboard`: `POST` + `X-Infra-Dashboard: 1` + an `Origin`/`Referer` that matches `Host`. That is CSRF cover only — the port itself is still unauthenticated.

## 5. Hard rules
- Never read, print or commit secrets (.env, tokens, keys, cookies).
- Do not change security-sensitive code without asking first and explaining the change: `postMessage` origin checks, cookie settings, CSP / `frame-ancestors`, anything touching auth or the bank.
- Do not touch an app's code unless the task says so — the city layer sits on top of them.
- **I run and deploy. You edit.** Do not start dev servers, containers, builds or `terraform`/`terragrunt`. Verify statically (read the file, grep for the reference, check brace/route balance) and say what you could not verify.
- Never edit `package.json` or a lockfile: production images build with `npm install --legacy-peer-deps`.
- `city-core` stays no-build: static ES modules, self-hosted three.js, no CDN. The home stays React + Vite (owner-approved exception to the old raw-HTML rule).
- Theme edits go to `city-core/city.css` and `THEME.md` — never re-declare tokens inside an app.
- Prefer registry data (`projects.ts` + `DISTRICTS` + `THEME.md`, all three together) over engine logic in `City.tsx`.
- Give complete files when I ask for a file, not partial diffs. Prefer direct shell commands over long explanations.
- If a task is unclear, ask one question instead of guessing.
- One small task per commit on `mini-city`. Never commit to main.

## 6. Run and test (I do this — for reference)
```bash
cd projects/intro/v3 && npm install --legacy-peer-deps && npm run dev   # home at /, city at /city
python3 -m http.server 8080 --directory projects                        # serves /city-core/ for a district app run on its own
docker compose -f projects/gateway/docker-compose.yml -f projects/gateway/docker-compose.city.yml up -d --build
cd environments/prod-gateway && terragrunt plan                          # then apply, via infra-cli
```
Walk the city after every change: WASD + Shift, collide with a building, **E** near it, the ward record opens, "Open <ward>" loads the service on the same origin already signed in, the HUD balance updates after a spend, and `/city` asks for the bank login when you arrive cold. Bank down → chip goes amber, spend stays locked to one service, earnings queue and flush when it returns.

## 7. Contracts
- **Session:** one bank login per origin in `localStorage["city.session"]`; `window.CityAuth` (token, username, accountId) plus a `city:auth` event for the home. Districts inherit it — no token is copied anywhere else.
- **Money:** the browser moves money through the bank (`City.spend` = withdraw, `City.earn` = deposit, whole rupees), then calls the district backend via `City.api()` with the citizen's bank token headers. The backend verifies the citizen by replaying that token against the bank (`GET /accounts/{id}`) — no shared secret, no JWT parsing — and owns the domain rules. If the backend refuses after the bank charged, the browser refunds itself.
- **Safe Mode:** bank unreachable → spend only from the cached balance and only at one service; earnings queue locally and apply on reconnect; inflight items reconcile against the balance (the bank has no idempotency keys). Backends keep accepting a citizen they verified in the last 24 h.
- **Login gate:** `City.mountHud({ requireLogin: true })` by default — the page is blurred and inert until sign-in, non-dismissible. After a successful login the device stores username, token, last balance and a salted PBKDF2-SHA256 verifier (150k iterations) — never the password; needs https or localhost.
- **Bank URLs tried in order:** `window.CITY_BANK_BASE`, `window.CITY_BANK_BASES`, `/bank/api`, then `http://localhost:8080/api` when the page is on localhost. Money-moving calls never fail over; reads, login and register do. A gateway HTML error page counts as "bank down", not as a logout.
- **District boot:** `startCityApp({ service, title, accent, scene, requireLogin, home, backdrop })`; `accent` and the ward code default from `DISTRICTS[service]`.

## 8. Open queue (in order, one per commit)
1. Bank: server-side ledger + event IDs with `service`/`reason`, so safe-mode replays cannot double-pay and deposits stop being trust-based.
2. Per-service money rules wired end to end: hospital consultation/shift, grocery shifts, rent, API metering, creator earnings for blog/social/video.
3. Police (D-12): segregate Docker metrics per service, spike detection, the stop pipeline.
4. Video district: scrap the current UI, ship the new one with the extra endpoints.
5. Documents district: downloads section + therapist chatbot.
6. API Service: split it and add the remaining utility endpoints.
7. `frame-ancestors` + CSP headers on every service so only the city origin can embed it.
8. Status sync: one endpoint the home can poll to grey out a down ward (today only the bank's own reachability is known).

## 9. Owner-driven later (do not start unless asked)
- Removing per-app auth in favour of the city session everywhere; bank PIN.
- Anything that changes the bank's CORS or auth posture.
- Deleting the legacy `notes_pgdata` / `notes_static` / `notes_media` volumes or `var.notes_db_*` — that is the only remaining copy of old Notes data.

## 10. Found, not fixed (say the word on any of these)
- `projects/Bank Manager/frontend/src/app/services/citySafeModeLedger.ts` posts the cached balance with `targetOrigin: '*'`.
- Bank `application.yaml` hard-codes a PostgreSQL credential; Notes `settings.py` has `DEBUG = True` and a committed `SECRET_KEY`.
- `cdn.tailwindcss.com` is still allowed in the `/blog/` CSP.
- `hospital-city.js` leaves treated rows at `opacity .5`.
- `projects/gateway/docker-compose*.yml` (the local dev stack) is stale: no `/city-core/`, `/document/`, `/whisper/`, `/compiler/`.
- The `*_frontend_build` + named-volume pattern serves stale assets on re-apply; only deleting the volume refreshes it.
- `CITY_CORS_ORIGINS` / `CITY_ALLOWED_HOSTS` in compose are read by nothing — `CityLocalHosts.java` was never wired into Bank Manager (`WebConfig.java` already whitelists localhost, so nothing is broken).
- `projects/intro/v3/AGENTS.md` and `CLAUDE.md` are Figma Make leftovers: there is no dev server pre-attached on `$PORT` outside Figma Make, and they know nothing about the registry or the theme contract.
- The Helm `targetRevision` pins in `gitops/social-media/apps/ingress-nginx-app.yaml` and `gitops/observability/apps/*` are unverified (no `helm` on this host, each carries a `# TODO: confirm` note). If a sync reports "chart ... version X not found", the pin is the cause, not ArgoCD.
- Social: `platform/scripts/inject.sh` re-embeds the pre-city dark frontend; ~50 unused shadcn `ui/*.tsx` files still hard-code `text-white`; `bankService.js` and `bankService.ts` are duplicates; the Whatsapp app overwrites `document.title`.

## 11. Definition of done
Every file you changed is consistent with `THEME.md` and the registry table; nothing references a deleted path; gateway routes, Terraform resources and `infra-cli` addresses agree; I can deploy from a clean checkout without `plan` failing; and the walk test in §6 passes with no console errors. Commit message states what changed and why.
