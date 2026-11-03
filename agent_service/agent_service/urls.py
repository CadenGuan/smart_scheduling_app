from django.urls import path, include

urlpatterns = [
    path('api/agent/', include('agent_api.urls')),
]
