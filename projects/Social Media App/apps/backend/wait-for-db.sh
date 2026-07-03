#!/bin/sh

TIMEOUT=60
i=0

echo "Starting up - waiting 5 seconds for DNS to be ready..."
sleep 5

echo "Waiting for Postgres..."
while [ $i -lt $TIMEOUT ]; do
  result=$(python -c "
import socket, sys
try:
    socket.getaddrinfo('postgres', 5432)
    s = socket.create_connection(('postgres', 5432), timeout=2)
    s.close()
    print('OK')
    sys.exit(0)
except Exception as e:
    print('FAIL:' + str(e))
    sys.exit(1)
" 2>&1)
  
  echo "Attempt $i: $result"
  
  if echo "$result" | grep -q "^OK"; then
    break
  fi
  
  sleep 2
  i=$((i+1))
done

if [ $i -ge $TIMEOUT ]; then
    echo "Postgres not ready after $TIMEOUT attempts, exiting."
    exit 1
fi

echo "Postgres is ready!"

# MinIO check in background
(
  i=0
  echo "Checking MinIO in background..."
  while [ $i -lt 30 ]; do
    result=$(python -c "
import socket, sys
try:
    socket.getaddrinfo('minio', 9000)
    s = socket.create_connection(('minio', 9000), timeout=2)
    s.close()
    sys.exit(0)
except:
    sys.exit(1)
" 2>&1)
    if [ $? -eq 0 ]; then
      echo "MinIO is ready!"
      break
    fi
    sleep 2
    i=$((i+1))
  done
  echo "MinIO check done."
) &

echo "Running migrations and collecting static files..."
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "Starting Gunicorn server..."
# Also switch to env vars — flags are deprecated in newer versions
export OTEL_SERVICE_NAME="social-media-backend"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-gateway:4318"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"

exec opentelemetry-instrument \
    gunicorn social_media.wsgi:application --bind 0.0.0.0:8000