#!/bin/bash
set -e

echo "Waiting for PostgreSQL..."
until (echo > /dev/tcp/$DB_HOST/$DB_PORT) >/dev/null 2>&1; do
  echo "PostgreSQL unavailable..."
  sleep 2
done
echo "PostgreSQL is ready!"

# FIX: jar is pre-built at image build time — just run it directly
exec java -jar /app/app.jar