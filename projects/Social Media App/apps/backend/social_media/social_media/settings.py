import os
from pathlib import Path
import environ
from datetime import timedelta
import socket

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Environment variables
env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

SECRET_KEY = env("SECRET_KEY", default="unsafe-secret-key")
DEBUG = env.bool("DEBUG", default=True)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "saisakthi.qzz.io"])

# Installed apps
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "graphene_django",
    'django_prometheus',

    # Your apps
    "apps.users",
    "apps.posts",
    "apps.messages",
    "apps.notifications",
    "apps.stories",
]

# Only add debug_toolbar if DEBUG is True AND not running in Docker production
RUNNING_IN_DOCKER = env.bool("RUNNING_IN_DOCKER", default=False)
if DEBUG and not RUNNING_IN_DOCKER:
    INSTALLED_APPS.append("debug_toolbar")

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]

# Only add debug toolbar middleware if it's in INSTALLED_APPS
if "debug_toolbar" in INSTALLED_APPS:
    MIDDLEWARE.append("debug_toolbar.middleware.DebugToolbarMiddleware")

MIDDLEWARE.append('django_prometheus.middleware.PrometheusAfterMiddleware')

ROOT_URLCONF = "social_media.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "social_media.wsgi.application"
ASGI_APPLICATION = "social_media.asgi.application"

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT'),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = 'users.CustomUser'

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/social/minio/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    'DEFAULT_THROTTLE_RATES': {
        'message_send':      '30/minute',
        'story_create':      '10/hour',
        'notification_read': '20/minute',
        'conversation':      '20/minute',
        'note_create':       '60/hour',
        'register':          '5/minute',
        'login':             '10/minute',
        'profile_update':    '10/hour',
    }
}

# Simple JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# CORS
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True

# GraphQL
GRAPHENE = {
    "SCHEMA": "social_media.schema.schema"
}

# Debug Toolbar configuration
if "debug_toolbar" in INSTALLED_APPS:
    hostname, _, ips = socket.gethostbyname_ex(socket.gethostname())
    INTERNAL_IPS = ["127.0.0.1", "localhost"] + [ip[:-1] + "1" for ip in ips]

    DEBUG_TOOLBAR_CONFIG = {
        "SHOW_TOOLBAR_CALLBACK": lambda request: DEBUG and not RUNNING_IN_DOCKER
    }

# --- MinIO Storage ---
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        "OPTIONS": {
            "access_key":        "minio",
            "secret_key":        "minio123",
            "bucket_name":       "media",
            "endpoint_url":      "http://minio:9000",
            "custom_domain":     "saisakthi.qzz.io/social/minio/media",
            "url_protocol":      "https:",   # BUG FIX 2: was "http:" — caused mixed-content errors on HTTPS site
            "querystring_auth":  False,
            "file_overwrite":    False,
            "default_acl":       "public-read",
        },
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

# --- Redis ---
REDIS_HOST = env("REDIS_HOST", default="redis")
REDIS_PORT = env.int("REDIS_PORT", default=6379)

import redis
REDIS_CLIENT = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# --- Java Microservice (Cassandra) ---
JAVA_API_URL = env("JAVA_API_URL", default="http://microservice-java:8080")

# concatenate them into "http://saisakthi.qzz.iohttps://saisakthi.qzz.io" (one broken URL).
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://saisakthi.qzz.io",   # ← comma was missing here
    "https://saisakthi.qzz.io",
])

FORCE_SCRIPT_NAME = '/social'
LOGIN_URL = '/social/login/'
LOGIN_REDIRECT_URL = '/social/'
LOGOUT_REDIRECT_URL = '/social/login/'
REGISTER_REDIRECT_URL = '/social/register/'