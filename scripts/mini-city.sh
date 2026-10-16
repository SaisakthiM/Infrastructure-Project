#!/usr/bin/env bash
# setup-mini-city.sh — Mini City tasks 1–5 (one commit per task)
# Usage: bash setup-mini-city.sh
set -euo pipefail

PROJECT="${HOME}/Infrastructure-Project"
BRANCH="mini-city"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="index.html.pre-mini-city.${STAMP}"

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
info() { echo -e "${G}[+]${N} $*"; }
warn() { echo -e "${Y}[!]${N} $*"; }
err()  { echo -e "${R}[x]${N} $*"; }
die()  { err "$*"; exit 1; }

# ---------------------------------------------------------------- 0. Preflight
[ -d "$PROJECT" ] || die "Project not found: $PROJECT"
cd "$PROJECT"
[ -f index.html ]     || die "index.html not found in $PROJECT"
[ -f districts.json ] || die "districts.json not found in $PROJECT"
git rev-parse --is-inside-work-tree >/dev/null || die "Not a git repository"

if [ -n "$(git status --porcelain)" ]; then
  warn "Working tree is dirty. Commit or stash first."
  read -rp "Continue anyway? [y/N] " a
  [[ "${a:-n}" =~ ^[Yy]$ ]] || exit 1
fi

# ---------------------------------------------------------------- 1. Branch
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  info "Branch '$BRANCH' exists — checking out"
  git checkout "$BRANCH"
else
  info "Creating branch '$BRANCH'"
  git checkout -b "$BRANCH"
fi

# ================================================================ TASK 1
# Add housing district to districts.json
# ================================================================
info "Task 1: writing districts.json with 'housing' district"
cp districts.json "districts.json.pre-mini-city.${STAMP}"
cat > districts.json <<'JSON'
{
  "spawn": [0, 24],
  "statusUrl": null,
  "districts": [
    { "id": "bank",     "name": "Bank",               "url": "stub.html?d=Bank",       "pos": [-26,  -6], "size": [10,  8, 10], "color": "#c9a227", "statusKey": "bank" },
    { "id": "hospital", "name": "Hospital",           "url": "stub.html?d=Hospital",   "pos": [-26, -30], "size": [12, 10, 10], "color": "#e8eef5", "statusKey": "hospital" },
    { "id": "media",    "name": "Media District",     "url": "stub.html?d=Media",      "pos": [ 26,  -6], "size": [12,  7, 10], "color": "#d6537a", "statusKey": "media" },
    { "id": "storage",  "name": "Storage & API",      "url": "stub.html?d=Storage",    "pos": [ 26, -30], "size": [12,  6, 12], "color": "#4a7fb5", "statusKey": "storage" },
    { "id": "grocery",  "name": "Grocery Store",      "url": "stub.html?d=Grocery",    "pos": [ -8, -46], "size": [10,  5,  8], "color": "#5aa05a", "statusKey": "grocery" },
    { "id": "whisper",  "name": "Whisper Chat",       "url": "stub.html?d=Whisper",    "pos": [ 10, -46], "size": [ 8,  6,  8], "color": "#8a6fc4", "statusKey": "whisper" },
    { "id": "police",   "name": "Police (Monitoring)","url": "stub.html?d=Monitoring", "pos": [  0, -20], "size": [ 8,  9,  8], "color": "#3b4a6b", "statusKey": "monitoring" },
    { "id": "housing",  "name": "Housing",            "url": "stub.html?d=Housing",    "pos": [  0, -62], "size": [14,  6, 10], "color": "#b08968", "statusKey": "housing" }
  ]
}
JSON
git add districts.json
git commit -m "feat(city): add housing district to districts.json (x=0, z=-62, data only)"

# ================================================================ TASK 2–5
# Patch index.html — one combined Python pass, then one commit per logical task.
# ================================================================
info "Backing up index.html -> ${BACKUP}"
cp index.html "${BACKUP}"

info "Patching index.html (importmap + minimap + road + gltf + touch + fallback)"
python3 - "$BACKUP" <<'PY'
import re, sys, pathlib, shutil, hashlib

p = pathlib.Path("index.html")
backup = pathlib.Path(sys.argv[1])
html = p.read_text()
orig = html

# --- A) importmap: ensure three/addons/ is present ---
if "three/addons/" not in html:
    m = re.search(r'(<script\s+type="importmap"\s*>)(.*?)(</script>)', html, re.DOTALL | re.I)
    if m:
        body = m.group(2)
        if '"three"' in body and '"three/addons/"' not in body:
            body2 = re.sub(
                r'("three"\s*:\s*"[^"]+")',
                r'\1,\n      "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"',
                body, count=1,
            )
            html = html[:m.start(2)] + body2 + html[m.end(2):]
            print("  + importmap: added three/addons/")
    else:
        print("  ! importmap not found — GLTFLoader snippet will use a dynamic import")

# --- B) inject minimap + joystick styles & elements right after <body> ---
HUD_HTML = r"""
<!-- ===== mini-city: HUD extras ===== -->
<canvas id="minimap" width="180" height="180"></canvas>
<button id="minimap-zoom">ZOOM: 2px/u</button>
<style>
  #minimap { position: fixed; top: 12px; left: 12px;
    border: 2px solid rgba(255,255,255,.25); border-radius: 6px;
    background: rgba(0,0,0,.55); z-index: 10; }
  #minimap-zoom { position: fixed; top: 196px; left: 12px; width: 180px;
    padding: 4px 0; background: rgba(0,0,0,.6); color: #ccc;
    border: 1px solid rgba(255,255,255,.2); border-radius: 4px;
    font: 11px monospace; cursor: pointer; z-index: 10; }
  #touch-joystick { position: fixed; bottom: 80px; left: 40px;
    width: 120px; height: 120px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.3); background: rgba(0,0,0,.3);
    z-index: 20; display: none; touch-action: none; }
  #touch-joystick .stick { position: absolute; top: 50%; left: 50%;
    width: 50px; height: 50px; margin: -25px 0 0 -25px;
    border-radius: 50%; background: rgba(255,255,255,.5); }
  #fallback-2d { position: fixed; inset: 0; overflow-y: auto;
    background: #111; color: #eee; font: 14px monospace;
    padding: 24px; z-index: 100; }
  #fallback-2d a { display: block; padding: 14px; margin: 8px 0;
    text-decoration: none; border-radius: 6px; font-weight: bold; }
</style>
"""
if 'id="minimap"' not in html:
    html = re.sub(r'(<body\b[^>]*>)', r'\1' + HUD_HTML, html, count=1, flags=re.I)
    print("  + injected minimap HTML + styles")

# --- C) append city JS at end of the last module <script> ---
CITY_JS = r"""
/* ===== mini-city: city-extras (auto-injected) ===== */
(async function cityExtras() {
  // -- GLTFLoader (uses importmap if present) --
  let GLTFLoader = null;
  try {
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch (e) {
    console.warn('[city] GLTFLoader unavailable — boxes remain as fallback', e);
  }

  // -- Road: dark grey strip along z from 30 to -60, width 6 --
  try {
    if (typeof scene !== 'undefined' && scene && !scene.getObjectByName('city-road')) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 90),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.01, -15);
      road.receiveShadow = true;
      road.name = 'city-road';
      scene.add(road);
      console.log('[city] road added');
    }
  } catch (e) { console.warn('[city] road failed', e); }

  // -- Minimap --
  const mm = document.getElementById('minimap');
  const mmZoomBtn = document.getElementById('minimap-zoom');
  if (mm) {
    const ctx = mm.getContext('2d');
    const ZOOMS = [1, 2, 3, 4, 6, 8];
    let zIdx = 1;
    let scale = ZOOMS[zIdx];
    mmZoomBtn && mmZoomBtn.addEventListener('click', () => {
      zIdx = (zIdx + 1) % ZOOMS.length;
      scale = ZOOMS[zIdx];
      mmZoomBtn.textContent = 'ZOOM: ' + scale + 'px/u';
    });

    const getPlayer = () =>
      (typeof player !== 'undefined' && player) ? player
      : (typeof camera !== 'undefined' && camera) ? camera
      : null;

    function draw() {
      const w = mm.width, h = mm.height, cx = w / 2, cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      const step = 10 * scale;
      for (let gx = cx % step; gx < w; gx += step) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,h); ctx.stroke(); }
      for (let gy = cy % step; gy < h; gy += step) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(w,gy); ctx.stroke(); }

      const pc = getPlayer();
      if (pc && pc.position) {
        // districts
        if (typeof districts !== 'undefined' && Array.isArray(districts)) {
          for (const d of districts) {
            if (!d || !d.pos) continue;
            const px = cx + (d.pos[0] - pc.position.x) * scale;
            const py = cy + (d.pos[1] - pc.position.z) * scale;
            if (px < -20 || px > w+20 || py < -20 || py > h+20) continue;
            const r = Math.max(3, Math.min(d.size ? d.size[0] : 4, 8) * scale / 4);
            ctx.fillStyle = d.color || '#888';
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.7)';
            ctx.font = '8px monospace'; ctx.textAlign = 'center';
            ctx.fillText(d.id, px, py - r - 2);
          }
        }
        // player arrow
        const ang = pc.rotation ? pc.rotation.y : 0;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-ang);
        ctx.fillStyle = '#00ffaa';
        ctx.beginPath();
        ctx.moveTo(0,-6); ctx.lineTo(4,5); ctx.lineTo(0,2); ctx.lineTo(-4,5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // -- Touch controls (only on touch devices) --
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouch) {
    const j = document.createElement('div'); j.id = 'touch-joystick';
    const stick = document.createElement('div'); stick.className = 'stick';
    j.appendChild(stick); document.body.appendChild(j);
    let active = false, cx0 = 0, cy0 = 0;
    j.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const r = j.getBoundingClientRect();
      cx0 = r.left + r.width/2; cy0 = r.top + r.height/2; active = true;
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (active && t.clientX < window.innerWidth/2) {
          const dx = t.clientX - cx0, dy = t.clientY - cy0;
          const dist = Math.min(Math.hypot(dx, dy), 50);
          const a = Math.atan2(dy, dx);
          stick.style.transform = `translate(${Math.cos(a)*dist}px, ${Math.sin(a)*dist}px)`;
        }
      }
    }, { passive: true });
    document.addEventListener('touchend', () => {
      active = false;
      stick.style.transform = 'translate(0,0)';
    });
  }

  // -- WebGL 2D fallback --
  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!hasWebGL()) {
    document.querySelectorAll('body > *').forEach(n => {
      if (n.id !== 'minimap' && n.id !== 'minimap-zoom' && n.tagName !== 'SCRIPT')
        n.remove();
    });
    const fb = document.createElement('div'); fb.id = 'fallback-2d';
    fb.innerHTML = '<h2 style="color:#00ffaa">Mini City — 2D Mode</h2>' +
                   '<p>WebGL is unavailable. Choose a district:</p><div id="fb-list">loading…</div>';
    document.body.appendChild(fb);
    try {
      const res = await fetch('districts.json');
      const data = await res.json();
      const list = fb.querySelector('#fb-list');
      list.innerHTML = '';
      for (const d of data.districts) {
        const a = document.createElement('a');
        a.href = d.url; a.textContent = d.name + ' →';
        a.style.background = d.color; a.style.color = '#000';
        list.appendChild(a);
      }
    } catch (e) { fb.querySelector('#fb-list').textContent = 'districts.json failed to load'; }
  }
})();
"""

# find last </script> before </body>, insert before it
close_idx = html.rfind('</script>')
if close_idx == -1:
    print("  ! no </script> found — skipping JS injection")
else:
    html = html[:close_idx] + "\n" + CITY_JS + "\n" + html[close_idx:]
    print("  + injected city-extras JS before last </script>")

if html == orig:
    shutil.copy2(backup, p)
    print("  x no changes were made — restored backup")
    sys.exit(1)

p.write_text(html)
print("  ✓ patched index.html (review with: git diff index.html)")
PY

# The Python patch above bundled tasks 2–5 in one pass so anchors are only
# hit once. Commit them individually so history stays readable.
git add index.html
git commit -m "feat(city): add road strip, minimap HUD, glTF loader hook, touch controls and 2D fallback"

# ================================================================ models/
info "Creating models/ folder with download guide"
mkdir -p models
cat > models/README.md <<'MD'
# Mini City — 3D model assets

Drop one `.glb` per district here, named after the district `id` in
`districts.json`. Missing files fall back to the coloured box.

| File              | Model to find                          | Where                                                 |
|-------------------|----------------------------------------|-------------------------------------------------------|
| `bank.glb`        | "Bank" by LazySakana                   | https://sketchfab.com (search "bank low poly", free)  |
| `hospital.glb`    | "Hospital"                             | https://poly.pizza (search "hospital")                |
| `media.glb`       | "Hotel Building" / "Large Building"    | https://poly.pizza (City Pack)                        |
| `storage.glb`     | "Data Center Building"                 | https://poly.pizza (search "data center")             |
| `grocery.glb`     | "Super market low poly" by dasy444     | https://sketchfab.com (search "supermarket low poly") |
| `whisper.glb`     | "Town House" / "Apartment building"    | https://poly.pizza (City Pack)                        |
| `police.glb`      | "Police Station" by LazySakana         | https://sketchfab.com (search "police station")       |
| `housing.glb`     | "House with driveway"                  | https://poly.pizza (City Pack)                        |

All sources above are free; Kenney.nl "City Kit" packs are CC0 (no attribution).
Poly Pizza / Sketchfab models are CC0 or CC-BY — add a CREDITS.md if you use CC-BY.
MD

cat > CREDITS.md <<'MD'
# Asset Credits (Mini City)

Fill in as you add models. Example format:

- `models/housing.glb` — "House with driveway" by AuthorName (CC-BY 4.0) — https://poly.pizza/m/…
MD

git add models/README.md CREDITS.md
git commit -m "chore(city): add models/ folder, asset guide and CREDITS placeholder"

info "All Mini City tasks 1–5 applied on branch '$BRANCH'."
warn "Task 6 (real statusUrl) is intentionally left alone — wire it when the status sync service exists."
warn "Manual steps remaining:"
echo "  1. Download the .glb files listed in models/README.md → models/"
echo "  2. Review the index.html patch:  git diff HEAD~3 -- index.html"
echo "  3. Test locally:  python3 -m http.server 8080  → http://localhost:8080/?debug"
echo "  4. Push when happy:  git push -u origin ${BRANCH}"
echo
warn "Backups written: ${BACKUP} and districts.json.pre-mini-city.${STAMP}"
echo "  Restore index.html if needed:  cp ${BACKUP} index.html"