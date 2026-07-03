from .settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable MinIO completely
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
MEDIA_ROOT = '/tmp/test-media'
MINIO_ENDPOINT = None
MINIO_ACCESS_KEY = 'test'
MINIO_SECRET_KEY = 'test'
MINIO_BUCKET = 'test'