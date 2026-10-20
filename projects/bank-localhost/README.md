# Bank on localhost

The bank's own source (Spring Boot + its web UI) was not in the zip, so this folder is the part I could write
without seeing it. Three things decide whether the bank "works on localhost":

## 1. `localhost/bank/` shows `403 Forbidden` (nginx)

That page is the **gateway**, not Spring. In `gateway/nginx/default.conf` the bank UI is

    location /bank/ { root /apps; try_files $uri $uri/ /bank/index.html; }

`403` means `/apps/bank/` exists inside the gateway container but has **no `index.html`** (nginx refuses to list a
directory). In production the bank UI is mounted there; in your local compose it is not (or it was built into a sub-folder).
Check, from the folder with your compose files:

    docker compose exec gateway ls -la /apps/bank

- empty / no `index.html`  -> mount the folder that holds the built bank UI at `/apps/bank` in the gateway service
  (same as the production mount; e.g. `- ../bank/frontend/dist:/apps/bank:ro`).
- `index.html` is one level down (`/apps/bank/dist/index.html`) -> mount that inner folder instead.

The new `default.conf` also makes this failure readable: it answers `/bank/` with a small "bank UI not found" page
instead of a bare 403, and keeps the gateway alive when the bank container is down (see section 3).

## 2. Browser -> bank API ("list of hosts")

The city client (`city-core.js`) tries, in order: `/bank/api` (through the gateway, same origin, no CORS needed), and
**on localhost only** the bank's published port `http://localhost:8080/api` / `http://127.0.0.1:8080/api` as a fallback.
The fallback is cross-origin, so the bank has to allow `http://localhost` as an origin.

- Easiest: copy `CityLocalHosts.java` next to your other config classes (fix the `package` line). It reads
  `CITY_CORS_ORIGINS`; `docker-compose.city.yml` already sets it for `bank-backend`.
- If the bank already has its own origin / host list: find it with

      grep -rn "saisakthi.qzz.io" <bank repo>        # wherever your domain is listed, add localhost beside it
      grep -rniE "allowedOrigins|cors|allowed-hosts|allowedHostnames" <bank repo>

  and add `http://localhost`, `http://127.0.0.1` (and `:5173` if you run `vite dev`). Delete `CityLocalHosts.java`
  in that case so two configs do not fight.
- Spring Security's firewall has its own host allow-list only if somebody wrote
  `StrictHttpFirewall#setAllowedHostnames(...)`; the grep above finds it — add `localhost` there too.

## 3. The bank is not there

- Gateway: every upstream in `default.conf` is resolved at request time (`resolver 127.0.0.11` + a variable), so nginx
  **starts even when the bank container is down** (before, an unresolvable `bank-backend` made the whole gateway exit).
  `/bank/api/` then answers `503 {"success":false,"message":"Bank unavailable"}`.
- City client: that 503 (or a network error, or an HTML gateway page) is "bank down". A known person signs in against
  the verifier kept on this device and the city runs in Safe Mode; a person this device has never seen is refused with
  a clear message and a Retry button. Extra bank URLs can be added with `window.CITY_BANK_BASES = [...]`.
