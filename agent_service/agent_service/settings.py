import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from agent_service/.env or server/.env
load_dotenv(BASE_DIR / '.env', override=True)
load_dotenv(BASE_DIR.parent / 'server' / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'ucsc-slug-agent-secret-key-2026')
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('true', '1', 't')
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]', '*']

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'agent_api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'agent_service.urls'

WSGI_APPLICATION = 'agent_service.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
