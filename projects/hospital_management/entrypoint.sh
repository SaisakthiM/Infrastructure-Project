#!/bin/sh

echo "Collecting Static"
python manage.py collectstatic --noinput

echo "Running tests..."
python manage.py test hospital.tests.test_hospital -v 2

if [ $? -ne 0 ]; then
    echo "Tests failed — stopping!"
    exit 1
fi

echo "Running opentelemetry-bootstrap..."
opentelemetry-bootstrap -a install

echo "Tests passed — starting server..."
exec opentelemetry-instrument \
    --service_name=hospital-management \
    --exporter_otlp_endpoint=http://otel-gateway:4318 \
    --exporter_otlp_protocol=http/protobuf \
    --traces_exporter=otlp \
    --metrics_exporter=otlp \
    --logs_exporter=otlp \
    gunicorn hospital_management.wsgi:application --bind 0.0.0.0:8000