#!/usr/bin/env bash
# add_cache_mounts.sh
# Patches every Dockerfile.test with BuildKit cache mounts.
# Usage:
#   ./add_cache_mounts.sh          # dry-run (shows diff only)
#   ./add_cache_mounts.sh --apply  # applies changes

set -euo pipefail

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

PATCHED=0
SKIPPED=0
ALREADY=0

# ── Python does the regex work (avoids sed escaping hell) ────────────────────
patch_file() {
  local file="$1"
  python3 - "$file" << 'PYEOF'
import re, sys

file = sys.argv[1]
with open(file) as f:
    original = f.read()

text = original

# npm install / npm ci
text = re.sub(
    r'^(RUN )(npm (?:install|ci).*)$',
    r'RUN --mount=type=cache,id=npm-cache,target=/root/.npm \\\n    \2',
    text, flags=re.MULTILINE
)

# pip install (with or without --no-cache-dir)
text = re.sub(
    r'^(RUN )(pip install) --no-cache-dir (.*)$',
    r'RUN --mount=type=cache,id=pip-cache,target=/root/.cache/pip \\\n    \2 \3',
    text, flags=re.MULTILINE
)
text = re.sub(
    r'^(RUN )(pip install(?! --no-cache-dir).*)$',
    r'RUN --mount=type=cache,id=pip-cache,target=/root/.cache/pip \\\n    \2',
    text, flags=re.MULTILINE
)

# mvn / ./mvnw
text = re.sub(
    r'^(RUN )(\.?/?mvnw? .*)$',
    r'RUN --mount=type=cache,id=mvn-cache,target=/root/.m2 \\\n    \2',
    text, flags=re.MULTILINE
)

# go mod download / go get
text = re.sub(
    r'^(RUN )(go (?:mod download|get).*)$',
    r'RUN --mount=type=cache,id=go-mod-cache,target=/go/pkg/mod \\\n    --mount=type=cache,id=go-build-cache,target=/root/.cache/go-build \\\n    \2',
    text, flags=re.MULTILINE
)

if text == original:
    sys.exit(1)   # no change

print(text, end='')
sys.exit(0)
PYEOF
}

echo ""
echo "🔍 Scanning for Dockerfile.test files..."
echo ""

while IFS= read -r -d '' dockerfile; do

  # Skip already patched
  if grep -q -- "--mount=type=cache" "$dockerfile" 2>/dev/null; then
    echo "  ⏭  Already patched: $dockerfile"
    (( ALREADY++ )) || true
    continue
  fi

  patched_content=$(patch_file "$dockerfile") && changed=true || changed=false

  if $changed; then
    if $APPLY; then
      echo "$patched_content" > "$dockerfile"
      echo "  ✅ Patched: $dockerfile"
    else
      echo ""
      echo "── $dockerfile ──────────────────────────────────────"
      diff <(cat "$dockerfile") <(echo "$patched_content") || true
      echo "  📋 Would patch: $dockerfile"
    fi
    (( PATCHED++ )) || true
  else
    echo "  ⚠️  No matching RUN steps: $dockerfile"
    (( SKIPPED++ )) || true
  fi

done < <(find . -name "Dockerfile.test" -print0)

echo ""
echo "─────────────────────────────────────────────"
if $APPLY; then
  echo "  ✅ Patched      : $PATCHED files"
else
  echo "  📋 Would patch  : $PATCHED files (dry-run)"
fi
echo "  ⏭  Already done : $ALREADY files"
echo "  ⚠️  No match     : $SKIPPED files"
echo ""

if ! $APPLY; then
  echo "  👉 Run with --apply to patch:"
  echo "     ./add_cache_mounts.sh --apply"
  echo ""
fi