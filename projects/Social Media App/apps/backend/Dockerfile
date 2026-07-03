FROM python:3.12-slim-bookworm

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    dos2unix \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements first (better layer caching)
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements.txt \
    && pip install graphene-django \
    && pip check \
    && opentelemetry-bootstrap -a install

# Copy project files
COPY . .

# Copy and prepare entrypoint
COPY wait-for-db.sh /wait-for-db.sh
RUN dos2unix /wait-for-db.sh && chmod +x /wait-for-db.sh

ENV DJANGO_SETTINGS_MODULE=social_media.settings 

# Set working directory to Django project root
WORKDIR /app/social_media

CMD ["/wait-for-db.sh"]