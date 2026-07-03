#!/bin/sh
set -e

# Start MinIO with fixed WebUI port 9004
minio server /data --console-address ":9004" &
MINIO_PID=$!

# Wait until MinIO API responds
echo "Waiting for MinIO to be ready..."
until mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
    sleep 1
done

# Create buckets if not exist
echo "Creating required buckets..."
mc mb --ignore-existing local/media
mc mb --ignore-existing local/tempo-traces

# Keep MinIO running
wait $MINIO_PID
