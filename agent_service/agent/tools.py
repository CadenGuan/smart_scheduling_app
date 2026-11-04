import os
import re
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from langchain_core.tools import tool
from .dag_solver import get_prerequisite_chain, get_downstream_impact, audit_degree_progress

# Catalog cache
_CATALOG_CACHE: Optional[List[Dict[str, Any]]] = None

def get_course_catalog() -> List[Dict[str, Any]]:
    """Loads and caches the course catalog dataset from data/courses.json."""
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None:
        return _CATALOG_CACHE

    possible_paths = [
        os.environ.get('COURSES_DATA_PATH'),
        str(Path(__file__).resolve().parents[2] / 'data' / 'courses.json'),
        str(Path(__file__).resolve().parents[1] / 'data' / 'courses.json'),
        str(Path.cwd() / 'data' / 'courses.json'),
    ]
    for p in possible_paths:
        if p and os.path.exists(p):
            try:
                with open(p, 'r', encoding='utf-8') as f:
                    _CATALOG_CACHE = json.load(f)
                    return _CATALOG_CACHE
            except Exception:
                pass

    _CATALOG_CACHE = []
    return _CATALOG_CACHE

def find_courses(
    query: str = "",
    term: str = "Winter 2027",
    department: str = "",
    ge_type: str = ""
) -> List[Dict[str, Any]]:
    """
    Searches the in-memory course catalog matching query, term, department, and ge_type.
    Returns a list of matching course dictionaries with full CalendarEvent attributes.
    """
    catalog = get_course_catalog()
    results = []

    q = (query or "").strip().lower()
    t = (term or "").strip().lower()
    dept = (department or "").strip().upper()
    ge = (ge_type or "").strip().upper()

    for course in catalog:
        # Filter by term if provided
        if t:
            course_term = (course.get('term') or "").strip().lower()
            if t not in course_term and course_term not in t:
                continue

        # Filter by department if provided
        if dept:
            course_dept = (course.get('department') or "").strip().upper()
            course_code = (course.get('code') or "").strip().upper()
            if dept != course_dept and not course_code.startswith(dept) and dept not in course_dept:
                continue

        # Filter by GE type if provided
        if ge:
            raw_ge = course.get('ge')
            if isinstance(raw_ge, list):
                ge_list = [str(x).strip().upper() for x in raw_ge]
            elif isinstance(raw_ge, str) and raw_ge.strip():
                ge_list = [raw_ge.strip().upper()]
            else:
                ge_list = []
            if not any(ge in item or item.startswith(ge) for item in ge_list):
                continue

        # Filter by query keyword if provided
        if q:
            matchable = " ".join([
                str(course.get('code') or ""),
                str(course.get('title') or ""),
                str(course.get('instructor') or ""),
                str(course.get('location') or ""),
                str(course.get('description') or ""),
                str(course.get('department') or ""),
                str(course.get('ge') or ""),
            ]).lower()

            tokens = q.split()
            if q not in matchable and not all(token in matchable for token in tokens):
                continue

        course_copy = dict(course)
        if 'color' not in course_copy:
            course_copy['color'] = '#00B4DB'
        results.append(course_copy)

    return results

def is_course_requested_or_pinned(prompt: str, course: Dict[str, Any]) -> bool:
    """
    Determines if the user explicitly requested, pinned, or demanded a specific course in their prompt.
    """
    if not prompt:
        return False

    prompt_lower = prompt.lower()
    code = (course.get('code') or "").lower()
    cid = (course.get('id') or "").lower()
    code_no_space = code.replace(" ", "")

    code_parts = code.split()
    number = code_parts[-1] if len(code_parts) > 1 else ""

    # Check if number appears as a course identifier rather than a credit/unit amount
    has_letter = bool(re.search(r'[a-zA-Z]', number))
    number_in_prompt = False
    is_credit_context = bool(re.search(r'(?:credits?|units?)\s+(?:to\s+)?' + re.escape(number) + r'\b|\b' + re.escape(number) + r'\s*(?:credits?|units?)\b', prompt_lower))
    if number and not is_credit_context:
        if has_letter:
            number_in_prompt = bool(re.search(r'\b' + re.escape(number) + r'\b', prompt_lower))
        else:
            number_in_prompt = bool(re.search(r'\b(?:course|class|cse|math|am|ece|phys|art|phil|(?:replace|swap|switch)\b.+?\b(?:with|to|for))\s+' + re.escape(number) + r'\b', prompt_lower))

    course_in_prompt = (
        (code and re.search(r'\b' + re.escape(code) + r'\b', prompt_lower)) or
        (code_no_space and re.search(r'\b' + re.escape(code_no_space) + r'\b', prompt_lower)) or
        (cid and cid in prompt_lower) or
        number_in_prompt
    )

    if not course_in_prompt:
        return False

    # Negative checks: if course is specifically being dropped, asked about for prereqs/why, or replaced
    if re.search(r'\b(drop|withdraw|remove|drop\s+out\s+of)\b[^.?!;,]*\b' + re.escape(code) + r'\b', prompt_lower):
        return False
    if re.search(r'\b(replace|swap|switch|substitute)\s+(?:my\s+)?\b' + re.escape(code) + r'\b', prompt_lower):
        return False
    if re.search(r'\b(replace|swap|switch|substitute)\s+(?:my\s+)?\b' + re.escape(code_no_space) + r'\b', prompt_lower):
        return False
    if number and re.search(r'\b(replace|swap|switch|substitute)\s+(?:my\s+)?\b' + re.escape(number) + r'\b', prompt_lower):
        return False
    if re.search(r'\b(why\s+(?:do\s+you\s+)?recommend|prereq|prerequisite|path\s+to\s+take)\b[^.?!;,]*\b' + re.escape(code) + r'\b', prompt_lower):
        return False
    if re.search(r'\binstead\s+of\b[^.?!;,]*\b' + re.escape(code) + r'\b', prompt_lower):
        return False
    if number and re.search(r'\binstead\s+of\b[^.?!;,]*\b' + re.escape(number) + r'\b', prompt_lower):
        return False

    # Explicit pin keywords
    if re.search(r'\bpin(?:ned)?\b', prompt_lower):
        return True

    # Demand / addition / want patterns
    intent_patterns = [
        rf'\b(want|need|add|take|include|enroll|demand|must\s+have|require|put|sign\s+up\s+for)\b[^.?!;,]*\b{re.escape(code)}\b',
        rf'\b(want|need|add|take|include|enroll|demand|must\s+have|require|put|sign\s+up\s+for)\b[^.?!;,]*\b{re.escape(code_no_space)}\b',
        rf'\b{re.escape(code)}\b[^.?!;,]*\b(instead|please|is\s+required|must\s+be)\b',
        rf'\b{re.escape(code_no_space)}\b[^.?!;,]*\b(instead|please|is\s+required|must\s+be)\b',
        rf'\b(replace|swap|switch|substitute)\b[^.?!;,]*\b(with|for|to)\s+\b{re.escape(code)}\b',
        rf'\b(replace|swap|switch|substitute)\b[^.?!;,]*\b(with|for|to)\s+\b{re.escape(code_no_space)}\b',
        rf'\b(with|for|to)\s+\b{re.escape(code)}\b',
        rf'\b(with|for|to)\s+\b{re.escape(code_no_space)}\b',
    ]
    if number and number_in_prompt:
        intent_patterns.extend([
            rf'\b(replace|swap|switch|substitute)\b[^.?!;,]*\b(with|for|to)\s+\b{re.escape(number)}\b',
            rf'\b(with|for|to)\s+\b{re.escape(number)}\b',
        ])
        if has_letter:
            intent_patterns.append(
                rf'\b(want|need|add|take|include|enroll)\b[^.?!;,]*\b{re.escape(number)}\b'
            )
    for pat in intent_patterns:
        if re.search(pat, prompt_lower):
            return True

    return False

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

@tool
def search_course_catalog(
    query: str = "",
    term: str = "Winter 2027",
    department: str = "",
    ge_type: str = ""
) -> str:
    """Searches the official UCSC course catalog by query keyword, term, department code, or GE requirement category."""
    matches = find_courses(query=query, term=term, department=department, ge_type=ge_type)
    return json.dumps(matches)

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
        search_course_catalog,
    ]
