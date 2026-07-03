#!/bin/sh
set -e

echo "Running migrations..."
./sqlx migrate run --database-url "$DATABASE_URL"

echo "Starting server..."
exec ./whatsapp-backend