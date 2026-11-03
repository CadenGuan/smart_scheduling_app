from django.urls import path
from .views import process_agent_query

urlpatterns = [
    path('process/', process_agent_query, name='process_agent_query'),
]
