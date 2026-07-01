#!/usr/bin/env bash
set -euo pipefail

# Safe replacement script: creates .bak copies and shows files it will modify.
# Usage: ./scripts/replace_projects_root.sh --dry-run    # list files
#        ./scripts/replace_projects_root.sh             # modify files in place (.bak saved)

DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) echo "Usage: $0 [--dry-run]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Find candidate files under environments/ that contain ../../projects or ${path.module}/../../projects
if command -v rg >/dev/null 2>&1; then
  FILES=$(rg -l --hidden --no-ignore -S '\.\./\.\./projects' environments || true)
  FILES2=$(rg -l --hidden --no-ignore -S '\$\{path\.module\}/\.\./\.\./projects' environments || true)
  FILES="$FILES $FILES2"
else
  FILES=$(grep -RIn -- "\.\./\.\./projects" environments || true)
  FILES=$(echo "$FILES" | cut -d: -f1 | uniq)
fi

# Normalize
FILES=$(echo "$FILES" | tr '\n' ' ')

if [ -z "${FILES// /}" ]; then
  echo "No matches found under environments/"
  exit 0
fi

echo "Files matched:"
echo "$FILES" | tr ' ' '\n'

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run - no files will be modified"
  exit 0
fi

read -p "Proceed and create .bak copies before modifying these files? (y/N) " yn
case $yn in
  [Yy]* ) ;;
  *) echo "Aborting"; exit 1;;
esac

for f in $FILES; do
  if [ -z "$f" ]; then
    continue
  fi
  echo "Processing $f"
  cp "$f" "${f}.bak"
  # Replace ${path.module}/../../projects -> ${path.module}/${var.projects_root}
  sed -E -i "s|\$\{path\.module\}/\.\./\.\./projects|\$\{path.module\}/\$\{var.projects_root\}|g" "$f"
  # Replace ../../projects (standalone) -> ${var.projects_root}
  sed -E -i "s#\.\./\.\./projects#\$\{var.projects_root\}#g" "$f"
done

echo "Done. Backups are in *.bak files." 
