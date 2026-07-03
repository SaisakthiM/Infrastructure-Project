FROM python:3.12-slim

WORKDIR /app

# System deps for mysqlclient + build tools
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    pkg-config \
    default-libmysqlclient-dev \
    libssl-dev \
    curl \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    # Auto-installs instrumentation libs for django, requests, gunicorn, etc.
    opentelemetry-bootstrap -a install

COPY . .

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV DJANGO_SETTINGS_MODULE=blogsite.settings

EXPOSE 8000

WORKDIR /app/blogsite

ENTRYPOINT ["/entrypoint.sh"]