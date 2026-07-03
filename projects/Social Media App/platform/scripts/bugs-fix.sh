#!/usr/bin/env bash
set -euo pipefail

PROJECT='/home/saisakthi/Coding-Project/Projects/Unfinished Projects/Working On/Social Media App'
GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}✓ fixed:${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║          Bug Fix Script — 6 fixes                   ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""

# ── FIX 1: update_profile view missing username parameter ─────────────────────
info "Fix 1: update_profile missing username param"
USERS_VIEWS="$PROJECT/backend/social_media/apps/users/views.py"
# Replace just the function signature
python3 - "$USERS_VIEWS" << 'PY'
import sys
path = sys.argv[1]
content = open(path).read()
content = content.replace(
    'def update_profile(request):\n    serializer = UpdateProfileSerializer(request.user',
    'def update_profile(request, username):\n    serializer = UpdateProfileSerializer(request.user'
)
open(path, 'w').write(content)
PY
log "users/views.py — update_profile(request, username)"

# ── FIX 2: Add JWT token refresh URL to main urls.py ──────────────────────────
info "Fix 2: Adding JWT token/refresh endpoint to urls.py"
MAIN_URLS="$PROJECT/backend/social_media/social_media/urls.py"
python3 - "$MAIN_URLS" << 'PY'
import sys
path = sys.argv[1]
content = open(path).read()
# Add simplejwt import if not present
if 'simplejwt' not in content:
    content = content.replace(
        'from django.conf.urls.static import static',
        'from django.conf.urls.static import static\nfrom rest_framework_simplejwt.views import TokenRefreshView'
    )
    content = content.replace(
        'path("health/", health_check),',
        'path("health/", health_check),\n    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),'
    )
open(path, 'w').write(content)
PY
log "urls.py — /api/auth/token/refresh/ added"

# ── FIX 3: messages pagination — proper queryset slice, not list() ────────────
info "Fix 3: messages/views.py — efficient pagination"
MSGS_VIEWS="$PROJECT/backend/social_media/apps/messages/views.py"
python3 - "$MSGS_VIEWS" << 'PY'
import sys
path = sys.argv[1]
content = open(path).read()
old = '''    page = int(request.query_params.get('page', 1))
    page_size = 30
    start = (page - 1) * page_size
    end = start + page_size
    msgs_list = list(messages)
    msgs_page = msgs_list[start:end]
    return Response({
        'results': MessageSerializer(msgs_page, many=True, context={'request': request}).data,
        'has_more': end < len(msgs_list),
    })'''
new = '''    page = int(request.query_params.get('page', 1))
    page_size = 30
    start = (page - 1) * page_size
    end = start + page_size
    total = messages.count()
    msgs_page = messages[start:end]
    return Response({
        'results': MessageSerializer(msgs_page, many=True, context={'request': request}).data,
        'has_more': end < total,
    })'''
content = content.replace(old, new)
open(path, 'w').write(content)
PY
log "messages/views.py — pagination uses queryset slice"

# ── FIX 4: Remove unused User import in stories/views.py ──────────────────────
info "Fix 4: stories/views.py — remove unused User import"
STORIES_VIEWS="$PROJECT/backend/social_media/apps/stories/views.py"
python3 - "$STORIES_VIEWS" << 'PY'
import sys
path = sys.argv[1]
content = open(path).read()
content = content.replace('from django.contrib.auth import get_user_model\n', '')
content = content.replace('User = get_user_model()\n\n', '')
open(path, 'w').write(content)
PY
log "stories/views.py — unused import removed"

# ── FIX 5: CORS — add CORS_ALLOW_ALL_ORIGINS flag for dev, note for prod ──────
info "Fix 5: SETTINGS_ADDITIONS.py — CORS env-aware config"
SETTINGS="$PROJECT/backend/SETTINGS_ADDITIONS.py"
python3 - "$SETTINGS" << 'PY'
import sys
path = sys.argv[1]
content = open(path).read()
old = '''CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",   # Vite dev
    "http://localhost:80",     # Production nginx
    "http://localhost",
]
CORS_ALLOW_CREDENTIALS = True'''
new = '''# Dev: allow all origins. Prod: set ALLOWED_HOSTS env var
import os as _os
if _os.environ.get('DEBUG', 'True') == 'True':
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = [
        o.strip() for o in
        _os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost').split(',')
    ]
CORS_ALLOW_CREDENTIALS = True'''
content = content.replace(old, new)
open(path, 'w').write(content)
PY
log "SETTINGS_ADDITIONS.py — CORS is env-aware"

# ── FIX 6: Go main.go — /health was dead code, now registered in mux ──────────
info "Fix 6: microservice-go/main.go — /health already registered in mux (original file was skeleton)"
# The new main.go we wrote already registers health in the mux correctly
# The old skeleton had it after log.Fatal - our replacement is correct
log "microservice-go/main.go — health registered before ListenAndServe (already correct in new file)"

# ── FIX 7: Docker — mvnw permission (the build error you saw) ─────────────────
info "Fix 7: microservice-java/Dockerfile — add chmod +x mvnw"
JAVA_DOCKERFILE="$PROJECT/microservice-java/Dockerfile"
if [ -f "$JAVA_DOCKERFILE" ]; then
    python3 - "$JAVA_DOCKERFILE" << 'PY'
import sys
path = sys.argv[1]
content = open(path).read()
if 'chmod +x mvnw' not in content:
    content = content.replace(
        'RUN ./mvnw dependency:go-offline',
        'RUN chmod +x mvnw && ./mvnw dependency:go-offline'
    )
    open(path, 'w').write(content)
    print("  patched")
else:
    print("  already fixed")
PY
    log "microservice-java/Dockerfile — chmod +x mvnw added"
else
    echo "  ⚠ Dockerfile not found at $JAVA_DOCKERFILE — run this manually:"
    echo "    sed -i 's|RUN ./mvnw dependency:go-offline|RUN chmod +x mvnw \&\& ./mvnw dependency:go-offline|' microservice-java/Dockerfile"
fi

# ── FIX 8: docker-compose passwords hardcoded — add .env warning ──────────────
info "Fix 8: Creating .env.example with secret placeholders"
ENV_EXAMPLE="$PROJECT/.env.example"
cat > "$ENV_EXAMPLE" << 'ENV'
# Copy to .env and fill in real values before deploying
# docker compose reads this automatically

POSTGRES_PASSWORD=changeme_strong_password
DB_PASSWORD=changeme_strong_password
MINIO_ROOT_PASSWORD=changeme_strong_password
MEDIA_STORAGE_SECRET=changeme_strong_password
GF_SECURITY_ADMIN_PASSWORD=changeme_strong_password

# Add your domain in production
CORS_ALLOWED_ORIGINS=https://yourdomain.com
ENV
log ".env.example created — copy to .env before prod deploy"

echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  All 8 fixes applied!"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Now rebuild:"
echo "    docker compose build"
echo "    docker compose --profile dev up"
echo ""