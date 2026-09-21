#!/usr/bin/env bash
set -euo pipefail

cd ~/Infrastructure-Project/gitops/social-media/raw

declare -A WAVES=(
  ["00-namespace-limits.yaml"]="0"
  ["02-postgres-service.yaml"]="0"
  ["03-postgres-statefulset.yaml"]="0"
  ["16-redis-deployment.yaml"]="0"
  ["17-redis-service.yaml"]="0"
  ["18-minio-service.yaml"]="0"
  ["19-minio-deployment.yaml"]="0"

  ["04-backend-service.yaml"]="1"
  ["05-backend-deployment.yaml"]="1"
  ["06-frontend-service.yaml"]="1"
  ["07-frontend-deployment.yaml"]="1"
  ["20-ingress-api.yaml"]="1"
  ["21-ingress-minio.yaml"]="1"
  ["22-ingress-frontend.yaml"]="1"

  ["08-microservice-go-service.yaml"]="2"
  ["09-microservice-go-deployment.yaml"]="2"

  ["12-kafka-statefulset.yaml"]="3"
  ["13-kafka-service.yaml"]="3"
  ["14-cassandra-statefulset.yaml"]="3"
  ["15-cassandra-service.yaml"]="3"

  ["10-microservice-java-service.yaml"]="4"
  ["11-microservice-java-deployment.yaml"]="4"
)

for f in "${!WAVES[@]}"; do
  wave="${WAVES[$f]}"
  if [ ! -f "$f" ]; then
    echo "SKIP (not found): $f"
    continue
  fi

  # Skip if annotation already present
  if grep -q "argocd.argoproj.io/sync-wave" "$f"; then
    echo "ALREADY ANNOTATED: $f"
    continue
  fi

  # Use yq to insert the annotation. Requires yq v4+.
  if ! command -v yq >/dev/null; then
    echo "ERROR: yq not installed. Install: brew install yq" >&2
    exit 1
  fi

  yq eval -i ".metadata.annotations.\"argocd.argoproj.io/sync-wave\" = \"$wave\"" "$f"
  echo "wave=$wave → $f"
done

echo
echo "Done. Review with:"
echo "  grep -l 'sync-wave' *.yaml | xargs grep -H 'sync-wave'"