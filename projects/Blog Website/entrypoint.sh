#!/bin/sh
echo "Waiting for MySQL..."
until python -c "import socket,sys; socket.create_connection(('blog-db',3306),timeout=3)" 2>/dev/null; do
  echo "MySQL not ready, retrying in 3s..."
  sleep 3
done
echo "MySQL is ready!"
python manage.py makemigrations --noinput
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py test blog.tests -v 2 --keepdb
exec opentelemetry-instrument \
    --service_name=blog-website \
    --exporter_otlp_endpoint=http://otel-gateway:4318 \
    --exporter_otlp_protocol=http/protobuf \
    --traces_exporter=otlp \
    --metrics_exporter=otlp \
    --logs_exporter=otlp \
    gunicorn blogsite.wsgi:application --bind 0.0.0.0:8000