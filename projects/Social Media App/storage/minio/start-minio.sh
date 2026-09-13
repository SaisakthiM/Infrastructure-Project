#!/bin/sh
set -e
minio server /data --console-address ":9004" &
MINIO_PID=$!
echo "Waiting for MinIO to be ready..."
until mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
    sleep 1
done
echo "Creating required buckets..."
mc mb --ignore-existing local/media
mc mb --ignore-existing local/tempo-traces
mc anonymous set download local/media
wait $MINIO_PID