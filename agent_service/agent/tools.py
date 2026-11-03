import json
from typing import Dict, Any, List
from langchain_core.tools import tool

# Context storage passed into tools at runtime
_active_context: Dict[str, Any] = {}

def set_tool_context(student: Dict[str, Any], preferences: Dict[str, Any], schedule: List[Dict[str, Any]]):
    global _active_context
    _active_context = {
        'student': student,
        'preferences': preferences,
        'schedule': schedule,
    }

@tool
def inspect_student_profile(query: str = "") -> str:
    """Inspects the student's active profile, including major, minor, standing, and target quarterly credits."""
    student = _active_context.get('student', {})
    prefs = _active_context.get('preferences', {})
    return json.dumps({
        'name': student.get('name', 'UCSC Student'),
        'major': student.get('major', 'Computer Science B.S.'),
        'standing': student.get('standing', 'Junior'),
        'minor': student.get('minor', None),
        'targetCredits': prefs.get('targetCredits', 15),
    })

@tool
def query_degree_ge_requirements(query: str = "") -> str:
    """Queries general education (GE) completion status and required major course requirements."""
    prefs = _active_context.get('preferences', {})
    ge_status = prefs.get('geStatus', {})
    remaining = ge_status.get('remaining', []) if isinstance(ge_status, dict) else []
    completed_major = prefs.get('majorRequirementsTaken', [])
    return json.dumps({
        'remainingGEs': remaining,
        'completedMajorRequirements': completed_major,
        'geSource': ge_status.get('source', 'UCSC') if isinstance(ge_status, dict) else 'UCSC',
    })

@tool
def inspect_calendar_schedule(query: str = "") -> str:
    """Inspects the student's current weekly schedule, enrolled courses, and Google Calendar busy commitments."""
    schedule = _active_context.get('schedule', [])
    return json.dumps({
        'enrolledCourses': schedule,
        'totalCount': len(schedule),
    })

def get_inspection_tools():
    return [
        inspect_student_profile,
        query_degree_ge_requirements,
        inspect_calendar_schedule,
    ]
