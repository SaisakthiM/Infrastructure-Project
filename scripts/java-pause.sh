#!/usr/bin/env bash
# pause-java.sh
# Stop JVM-heavy containers temporarily.
#
# Usage:
#   ./pause-java.sh stop      # stop them
#   ./pause-java.sh start     # start them again
#   ./pause-java.sh status    # show current state

set -euo pipefail

# Containers to manage. Adjust names if yours differ.
CONTAINERS=(
  "selenium_chrome"
  "selenium_java"
)

# Also handle in-cluster Cassandra and Kafka via kubectl, if reachable.
K8S_STATEFULSETS=(
  "cassandra"
  "kafka"
)

K8S_NAMESPACE="default"

action="${1:-}"

case "$action" in
  stop)
    echo "==> Stopping Docker containers..."
    for c in "${CONTAINERS[@]}"; do
      if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
        docker stop "$c" >/dev/null && echo "  stopped: $c"
      else
        echo "  not running: $c"
      fi
    done

    echo "==> Scaling down Kubernetes StatefulSets..."
    for s in "${K8S_STATEFULSETS[@]}"; do
      if kubectl get statefulset "$s" -n "$K8S_NAMESPACE" >/dev/null 2>&1; then
        kubectl scale statefulset "$s" -n "$K8S_NAMESPACE" --replicas=0 >/dev/null \
          && echo "  scaled to 0: $s"
      else
        echo "  not found: $s"
      fi
    done
    ;;

  start)
    echo "==> Starting Docker containers..."
    for c in "${CONTAINERS[@]}"; do
      if docker ps -a --format '{{.Names}}' | grep -q "^${c}$"; then
        docker start "$c" >/dev/null && echo "  started: $c"
      else
        echo "  container missing: $c (docker run/terraform apply to recreate)"
      fi
    done

    echo "==> Scaling up Kubernetes StatefulSets..."
    for s in "${K8S_STATEFULSETS[@]}"; do
      if kubectl get statefulset "$s" -n "$K8S_NAMESPACE" >/dev/null 2>&1; then
        kubectl scale statefulset "$s" -n "$K8S_NAMESPACE" --replicas=1 >/dev/null \
          && echo "  scaled to 1: $s"
      else
        echo "  not found: $s"
      fi
    done
    ;;

  status)
    echo "==> Docker containers:"
    for c in "${CONTAINERS[@]}"; do
      state=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo "missing")
      echo "  $c: $state"
    done

    echo "==> Kubernetes StatefulSets:"
    for s in "${K8S_STATEFULSETS[@]}"; do
      if kubectl get statefulset "$s" -n "$K8S_NAMESPACE" >/dev/null 2>&1; then
        ready=$(kubectl get statefulset "$s" -n "$K8S_NAMESPACE" -o jsonpath='{.status.readyReplicas}')
        echo "  $s: ${ready:-0} ready"
      else
        echo "  $s: not found"
      fi
    done
    ;;

  *)
    echo "Usage: $0 {stop|start|status}" >&2
    exit 1
    ;;
esac