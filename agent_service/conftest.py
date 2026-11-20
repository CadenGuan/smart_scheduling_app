import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "agent_service.settings")
os.environ.setdefault("USE_MOCK_AGENT", "true")
django.setup()
