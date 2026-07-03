#!/bin/sh

echo "⏳ Waiting for DB to be ready..."

DB_HOST="${DB_HOST:-doc-mysql}"

until python -c "import socket; socket.create_connection(('$DB_HOST', 3306), timeout=3)" 2>/dev/null; do
  echo "  DB not ready yet, retrying in 3s..."
  sleep 3
done

echo "✅ DB is ready"
echo "🔄 Running migrations..."
python manage.py migrate --noinput
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput
echo "🚀 Starting Gunicorn..."
exec opentelemetry-instrument \
    --service_name=document-backend \
    --exporter_otlp_endpoint=http://otel-gateway:4318 \
    --exporter_otlp_protocol=http/protobuf \
    --traces_exporter=otlp \
    --metrics_exporter=otlp \
    --logs_exporter=otlp \
    gunicorn document_backend.wsgi:application --bind 0.0.0.0:8000
