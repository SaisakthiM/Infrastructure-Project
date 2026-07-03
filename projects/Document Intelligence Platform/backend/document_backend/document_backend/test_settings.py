# document_backend/test_settings.py
from .settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

MINIO_ENDPOINT = 'localhost:9000'
MINIO_ACCESS_KEY = 'test-access-key'
MINIO_SECRET_KEY = 'test-secret-key'
MINIO_BUCKET = 'test-bucket'
MINIO_SECURE = False
GEMINI_API_KEY = 'test-key'
OLLAMA_HOST = 'localhost'
PORT_AI = '11434'