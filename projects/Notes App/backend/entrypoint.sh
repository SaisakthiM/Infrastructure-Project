#!/bin/sh
opentelemetry-bootstrap -a install
python manage.py migrate
exec opentelemetry-instrument \
    --service_name=notes-backend \
    --exporter_otlp_endpoint=http://otel-gateway:4318 \
    --exporter_otlp_protocol=http/protobuf \
    --traces_exporter=otlp \
    --metrics_exporter=otlp \
    --logs_exporter=otlp \
    gunicorn notes_app.wsgi:application --bind 0.0.0.0:8000