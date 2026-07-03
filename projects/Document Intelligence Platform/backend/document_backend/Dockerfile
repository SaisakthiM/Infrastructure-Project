FROM python:3.12-slim

WORKDIR /app

# Copy only requirements first for better layer caching
COPY requirements.txt .

RUN apt-get update && apt-get install -y \
    pkg-config \
    default-libmysqlclient-dev \
    gcc \
  && rm -rf /var/lib/apt/lists/*



# Combine pip installs and clean up cache in one layer
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    # Auto-installs instrumentation libs for django, requests, gunicorn, etc.
    opentelemetry-bootstrap -a install

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV DJANGO_SETTINGS_MODULE=document_backend.settings

COPY . .

ENTRYPOINT ["/entrypoint.sh"]