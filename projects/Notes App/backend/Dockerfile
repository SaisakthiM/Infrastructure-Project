FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    # Auto-installs instrumentation libs for django, requests, gunicorn, etc.
    opentelemetry-bootstrap -a install

COPY . /app/

WORKDIR /app/notes_app

RUN python manage.py collectstatic --noinput

EXPOSE 8000

ENV DJANGO_SETTINGS_MODULE=notes_app.settings

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
