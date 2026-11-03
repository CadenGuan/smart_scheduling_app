import json
from typing import Dict, Any, List
from langchain_core.tools import tool
from .dag_solver import get_prerequisite_chain, get_downstream_impact, audit_degree_progress

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

@tool
def explain_course_rationale(course_code: str = "") -> str:
    """Explains the academic justification, prerequisite progression, and workload rationale for taking a specific UCSC course."""
    student = _active_context.get('student', {})
    prefs = _active_context.get('preferences', {})
    major = student.get('major', 'Computer Science B.S.')
    return json.dumps({
        'course': course_code,
        'targetMajor': major,
        'rationale': f"Fulfills core major requirements for {major}, unblocks advanced electives, and balances credit load.",
        'targetCredits': prefs.get('targetCredits', 15),
    })

@tool
def find_prerequisite_path(target_course: str) -> str:
    """Finds the shortest prerequisite chain to unlock an advanced UCSC Computer Science course using the prerequisite DAG solver."""
    prefs = _active_context.get('preferences', {})
    completed = prefs.get('majorRequirementsTaken', [])
    chain = get_prerequisite_chain(target_course, completed)
    return json.dumps(chain)

@tool
def assess_drop_impact(course_code: str) -> str:
    """Evaluates the ripple effect and blocked downstream requirements if a student drops a specific course."""
    impact = get_downstream_impact(course_code)
    return json.dumps(impact)

@tool
def audit_degree_progress_tool(query: str = "") -> str:
    """Audits completed courses against core UCSC CS major requirements, returning progress percentage and unblocked courses."""
    prefs = _active_context.get('preferences', {})
    completed = prefs.get('majorRequirementsTaken', [])
    audit = audit_degree_progress(completed)
    return json.dumps(audit)

@tool
def update_schedule_preferences(
    target_credits: int = 15,
    preferred_free_days: List[str] = None,
    earliest_start_time: str = None,
    latest_end_time: str = None,
    max_back_to_back_hours: int = None,
) -> str:
    """Action tool that modifies the student's weekly scheduling constraints and target credits, updating their calendar preview."""
    updates: Dict[str, Any] = {'targetCredits': target_credits}
    if preferred_free_days is not None:
        updates['preferredFreeDays'] = preferred_free_days
    if earliest_start_time is not None:
        updates['earliestStartTime'] = earliest_start_time
    if latest_end_time is not None:
        updates['latestEndTime'] = latest_end_time
    if max_back_to_back_hours is not None:
        updates['maxBackToBackHours'] = max_back_to_back_hours

    return json.dumps({
        'status': 'PREFERENCES_UPDATED',
        'action': 'UPDATE_PREFERENCES',
        'updates': updates,
    })

def get_inspection_tools():
    return [
        inspect_student_profile,
        query_degree_ge_requirements,
        inspect_calendar_schedule,
        explain_course_rationale,
        find_prerequisite_path,
        assess_drop_impact,
        audit_degree_progress_tool,
        update_schedule_preferences,
    ]
