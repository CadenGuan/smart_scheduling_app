from django.urls import path

from .views import process_agent_query, solve_schedule_endpoint

urlpatterns = [
    path("process/", process_agent_query, name="process_agent_query"),
    path("solve/", solve_schedule_endpoint, name="solve_schedule_endpoint"),
]
