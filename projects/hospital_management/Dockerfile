FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    # Auto-installs instrumentation libs for django, requests, gunicorn, etc.
    opentelemetry-bootstrap -a install

COPY . .

ENV DJANGO_SETTINGS_MODULE=hospital_management.settings

RUN python manage.py migrate

EXPOSE 8000

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]