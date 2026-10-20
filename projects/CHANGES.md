# What changed, per project

## Round 2 — localhost bank, login gate, skins, API Service deploy

Copy the folders over your repo as before. NEW = new files.

- **city-core/** — `city-core.js` (login gate on every `mountHud`, local vault + offline sign-in, bank fallback URLs,
  gateway-error handling), `city.css` (gate styles). NEW: `city-gate.js`, `city-gate.css` (add the one `<script>` line to
  the city home page), `city-skin.js`, `city-skin.css`, `SKIN.md` (3D look for Whisper / Notes). README updated.
- **gateway/** — `nginx/default.conf`: serves any host (`localhost`, `127.0.0.1`, catch-all), every upstream resolved at
  request time so the gateway boots even when the bank (or any service) is down, `/bank/api/` answers a clean `503 JSON`
  when the bank is not there, `/bank/` shows a readable page instead of a bare 403, `/api-service/` never caches the page
  and explains itself when nothing is published, commented Whisper template (WebSocket headers).
  `docker-compose.city.yml`: `api-service-frontend-build` is now a one-shot that republishes on every run, CORS origins for
  localhost, `bank-backend` gets `CITY_CORS_ORIGINS` / `CITY_ALLOWED_HOSTS`.
- **API Service/frontend/api-service/** — NEW `Dockerfile.prod` (builds with `--base=/api-service/`, copies into the shared
  volume on every start, writes `/api-service/build.txt`) and `.dockerignore`. Most likely why the new services never showed (I could not see your original Dockerfile.prod):
  the old image only filled the volume once, so nginx kept serving the first build. `src/lib/city.ts` type tweak.
  If you already have a `Dockerfile.prod`, compare it with this one before overwriting.
- **bank-localhost/** (NEW) — `CityLocalHosts.java` (CORS for localhost, as a pre-Security filter) + `README.md`
  (why `localhost/bank/` is a 403 and how to fix it; where the host list lives). The bank source was not in the zip.
- **whisper/frontend/src/city/** (NEW) — `cityTheme.js` (MUI theme), `CityBackdrop.jsx`. Whisper source was not in the zip,
  so this is a theme + backdrop, not a rebuilt UI. Setup in `city-core/SKIN.md`.

---

# Round 1

Copy each folder over your repo (same paths). Files marked DELETE should be removed.

## city-core/  (NEW)  — see city-core/README.md
Put it next to the other projects. The gateway serves it at `/city-core/`.

## gateway/
- `nginx/default.conf` — replaces yours. Fixes: `/bank/api/` -> `/api/`, `/hospital/` keeps its prefix, `/video/api/` allows 220 MB uploads, adds city-core / grocery / housing / api-service.
- `docker-compose.city.yml` — NEW overlay (no secrets): `docker compose -f docker-compose.yml -f docker-compose.city.yml up -d --build`. Needs `GROCERY_SECRET_KEY` and `API_KEY_WEATHER` in `.env`.
- Production: mirror the same blocks in the environment/terraform nginx.

## hospital_management/
Why it failed: the models gained 5 columns (`consultation_fee`, `doctor_earnings`, `fee`, `doctor_payout`, `is_completed`) but **no migration was ever created**, so every doctor/appointment query hit "no such column"; and two `__str__` methods no longer matched the tests.
- `hospital/models.py`, `hospital/migrations/0002_city_economy.py` (NEW), `hospital/views.py`, `hospital/forms.py` (NEW), `hospital/urls.py`, `hospital/city_identity.py` (NEW), `hospital/context_processors.py` (NEW), `hospital/metrics_logger.py`
- `hospital/tests/test_hospital.py` — your tests kept, plus new ones
- `hospital_management/settings.py` (+context processor, +`HOSPITAL_METRICS_LOG`), `test_settings.py`
- `hospital/templates/*` (all rewritten, + `_field.html`), `hospital/static/hospital/{hospital.css,hospital-scene.js,hospital-city.js}`

## Grocery Store/
- backend: new app `market/` (products, atomic checkout, shifts that restock the shelves); new `grocery_backend/settings.py`, `urls.py`, `manage.py`, `pytest.ini`, `requirements.txt`, `Dockerfile`
- **`manage.py` had `DJANGO_SETTINGS_MODULE='pytest.ini'`** (a typo) — fixed.
- DELETE `backend/grocery_backend/users/` (per-app login/OAuth is gone; the bank is the identity). Its test was already broken.
- Set `DJANGO_SECRET_KEY` (the app refuses to start without it) and mount a volume for `GROCERY_DB_PATH`.
- frontend: `frontend/index.html` + `frontend/grocery.js` (3D store)

## Video Uploader/Main/
- backend: `FileController` (safe file names, owner-only delete), `MediaController` (NEW: library, Range streaming, views, likes, creator earnings), `EngagementService`, `BankIdentityService`, `UploadsDir` (NEW), `OmvSftpService` (now env-driven: `OMV_HOST/PORT/USER/PASSWORD/UPLOAD_DIR`), `application.properties` (200 MB)
- **The OMV SFTP password was hard-coded in `OmvSftpService.java` — it is in your git history, rotate it.**
- tests: `MediaControllerTest`, `EngagementServiceTest` (NEW); `FileControllerTest` unchanged
- frontend: DELETE `src/App.css`, `src/components/{Downlaod,HomePage,Media3DBackground,ModernVideoHub,Remove,Upload}.jsx`, `Getter.js`, and the four `*.test.jsx`. New: `src/components/MediaDistrict.jsx`, `src/scene/mediaScene.js`, `src/lib/*` (+ tests), `src/setupTests.js` (was missing, vitest config pointed at it), `index.html`, `vite.config.js`, `package.json` (three/express/tailwind dropped, `test` script added)

## API Service/
- backend: routes split into `weather`, `geo`, `markets` (stocks/crypto/FX), `world` (quakes/ISS), `exchange` (city stock exchange); `lib/*`; `app.js`, `bin/www`, `Dockerfile`; new tests in `tests/`. Your `api-service.test.js` is untouched and still satisfied (single-argument `axios.get(url)` calls preserved).
- fixed: upstream errors used to leave the request hanging (no response); latitude error said "Longitude"; non-numeric coords were accepted.
- frontend: new `Home` (3D globe), `World`, `Markets`, `Exchange`; `Weather`/`GeoCod` untouched (restyled via CSS only), `App.tsx`, `index.html`, CSS, `src/lib`, `src/scene`. Type-checked against your strict `tsconfig.app.json`.

## housing/  (NEW backend + rebuilt frontend)
- `backend/` FastAPI + sqlite: 24 plots, free checkpoint shelter, buy/upgrade/sell-back (70%), rent income (max 24 h per collect)
- `frontend/index.html` + `housing.js`. Your old `housing/index.html` is replaced (DELETE it); the gateway now copies `housing/frontend/`.
