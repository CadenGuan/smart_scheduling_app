from django.urls import include, path

urlpatterns = [
    path("api/agent/", include("agent_api.urls")),
]
