from django.urls import path, include
from agent_api.views import push_event_to_google

urlpatterns = [
    path('api/agent/', include('agent_api.urls')),
    path('api/sync/push/', push_event_to_google, name='push_event_to_google'),
]
