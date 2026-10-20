"""
Grocery Store API — Mini City district.

Identity comes from the city bank (see market/city_identity.py), so there is no per-app login,
no OAuth server and no user table here. Configure through environment variables:

  DJANGO_SECRET_KEY   required in production
  DJANGO_DEBUG        "1" to enable debug (default off)
  ALLOWED_HOSTS       comma separated (default covers local + saisakthi.qzz.io + service name)
  GROCERY_DB_PATH     sqlite file location (mount a volume here so stock survives restarts)
  BANK_API_URL        where to verify citizens (default http://bank-backend:8080/api)
"""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
RUNNING_TESTS = "pytest" in sys.modules or (len(sys.argv) > 1 and sys.argv[1] == "test")
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or ("dev-only-not-for-production" if (DEBUG or RUNNING_TESTS) else None)
if not SECRET_KEY:
    # fail loudly instead of silently running with a guessable key
    raise RuntimeError("Set DJANGO_SECRET_KEY (or DJANGO_DEBUG=1 for local development).")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        "ALLOWED_HOSTS", "localhost,127.0.0.1,grocery-backend,saisakthi.qzz.io"
    ).split(",")
    if h.strip()
]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "rest_framework",
    "market",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "grocery_backend.urls"
WSGI_APPLICATION = "grocery_backend.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("GROCERY_DB_PATH", str(BASE_DIR / "db.sqlite3")),
    }
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["market.authentication.CityAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "240/min"},
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# behind the nginx / Cloudflare tunnel
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
