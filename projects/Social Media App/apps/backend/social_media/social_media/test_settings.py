from .settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Remove debug toolbar for tests
INSTALLED_APPS = [app for app in INSTALLED_APPS]
DEBUG_TOOLBAR_CONFIG = {'IS_RUNNING_TESTS': False}

SECRET_KEY = 'test-secret-key-for-ci'
DEBUG = True

# social_media/test_settings.py — add this
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
MEDIA_ROOT = '/tmp/test_media/'

RATE_LIMIT_SERVICE_URL = 'http://localhost:0'  # unreachable
RATE_LIMIT_ENABLED = False

# social_media/test_settings.py — add these lines
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
MEDIA_ROOT = '/tmp/test_media/'