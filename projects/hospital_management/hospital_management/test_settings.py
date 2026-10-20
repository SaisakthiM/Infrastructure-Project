import os

from .settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# tests must never write analytics events into the real metrics file
HOSPITAL_METRICS_LOG = os.devnull
