import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "agent_service.settings")
django.setup()
