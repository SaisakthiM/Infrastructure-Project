import os
from pathlib import Path
from minio import Minio
from minio.error import S3Error

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-_9$gh=u4#z*o9!f!+i#43(2ma$of1pt)!_fbl^w(@6z31yqn5y'
DEBUG = False
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'saisakthi.qzz.io', "blog-website"]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'blog',
    'django_prometheus',
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]

ROOT_URLCONF = 'blogsite.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'blogsite.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.environ.get('DB_NAME', 'blog_db'),
        'USER': os.environ.get('DB_USER', 'root'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'saisakthi2008'),
        'HOST': os.environ.get('DB_HOST', 'db'),
        'PORT': os.environ.get('DB_PORT', '3306'),
        'OPTIONS': {
            'charset': 'utf8mb4',
        }
    }
}

# ─── MinIO Storage Configuration ───────────────────────────────────
MINIO_BUCKET = os.environ.get('MINIO_BUCKET', 'blog-media')
MINIO_ENDPOINT = os.environ.get('MINIO_ENDPOINT', 'http://minio:9000')
MINIO_ACCESS_KEY = os.environ.get('MINIO_ACCESS_KEY', 'admin')
MINIO_SECRET_KEY = os.environ.get('MINIO_SECRET_KEY', 'password123')
MINIO_PUBLIC_URL = os.environ.get('MINIO_PUBLIC_URL', 'http://localhost/blog/minio')

# ─── Storage Configuration ─────────────────────────────────────────
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        "OPTIONS": {
            "access_key": MINIO_ACCESS_KEY,
            "secret_key": MINIO_SECRET_KEY,
            "bucket_name": MINIO_BUCKET,
            "endpoint_url": MINIO_ENDPOINT,
            "file_overwrite": False,
            "url_protocol": "https:",
            "custom_domain": "saisakthi.qzz.io/blog/minio/blog-media",  # ← added /blog-media
        }
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    }
}

SECURE_CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "script-src 'self' https://cdn.tailwindcss.com https://static.cloudflareinsights.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://static.cloudflareinsights.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: blob: https://saisakthi.qzz.io; "  # ← added saisakthi.qzz.io
    "connect-src 'self' https://cloudflareinsights.com;"
)

# ─── MinIO Bucket Initialization (Graceful) ───────────────────────
def initialize_minio_bucket():
    try:
        minio_endpoint = MINIO_ENDPOINT.replace('http://', '').replace('https://', '')
        client = Minio(
            minio_endpoint,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=False
        )
        if not client.bucket_exists(MINIO_BUCKET):
            client.make_bucket(MINIO_BUCKET)
            print(f"✓ Created MinIO bucket: {MINIO_BUCKET}")
        else:
            print(f"✓ MinIO bucket already exists: {MINIO_BUCKET}")
    except S3Error as e:
        if "BucketAlreadyOwnedByYou" in str(e):
            print(f"✓ MinIO bucket already exists (BucketAlreadyOwnedByYou)")
        else:
            print(f"⚠ MinIO bucket initialization: {e}")
    except Exception as e:
        print(f"ℹ MinIO initialization deferred: {e}")

try:
    initialize_minio_bucket()
except Exception as e:
    print(f"ℹ MinIO initialization skipped: {e}")

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

MEDIA_URL = '/blog/media/'
MEDIA_ROOT = BASE_DIR / 'media'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'static/'
STATICFILES_DIRS = [BASE_DIR / 'blog' / 'static']

TEMPLATES[0]['DIRS'] = [BASE_DIR / 'templates']

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LOGIN_URL = '/blog/login/'
LOGIN_REDIRECT_URL = '/blog/'
LOGOUT_REDIRECT_URL = '/blog/'