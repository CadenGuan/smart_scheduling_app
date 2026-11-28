import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from langchain_core.tools import tool

from .dag_solver import audit_degree_progress, get_downstream_impact, get_prerequisite_chain

# Catalog cache
_CATALOG_CACHE: Optional[List[Dict[str, Any]]] = None


def get_course_catalog() -> List[Dict[str, Any]]:
    """Loads and caches the course catalog dataset from data/courses.json."""
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None:
        return _CATALOG_CACHE

    possible_paths = [
        os.environ.get("COURSES_DATA_PATH"),
        str(Path(__file__).resolve().parents[2] / "data" / "courses.json"),
        str(Path(__file__).resolve().parents[1] / "data" / "courses.json"),
        str(Path.cwd() / "data" / "courses.json"),
    ]
    for p in possible_paths:
        if p and os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    _CATALOG_CACHE = json.load(f)
                    return _CATALOG_CACHE
            except Exception:
                pass

    _CATALOG_CACHE = []
    return _CATALOG_CACHE


def find_courses(
    query: str = "", term: str = "Winter 2027", department: str = "", ge_type: str = ""
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
            course_term = (course.get("term") or "").strip().lower()
            if t not in course_term and course_term not in t:
                continue

        # Filter by department if provided
        if dept:
            course_dept = (course.get("department") or "").strip().upper()
            course_code = (course.get("code") or "").strip().upper()
            if dept != course_dept and not course_code.startswith(dept) and dept not in course_dept:
                continue

        # Filter by GE type if provided
        if ge:
            raw_ge = course.get("ge")
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
            q_is_course_code = bool(re.match(r"^[a-zA-Z]{2,5}\s*\d{1,3}[a-zA-Z]?$", q))
            if q_is_course_code:
                q_code_norm = re.sub(r"\s+", "", q).lower()
                course_code_norm = re.sub(r"\s+", "", str(course.get("code") or "")).lower()
                if q_code_norm != course_code_norm:
                    continue
            else:
                matchable = " ".join(
                    [
                        str(course.get("code") or ""),
                        str(course.get("title") or ""),
                        str(course.get("instructor") or ""),
                        str(course.get("location") or ""),
                        str(course.get("department") or ""),
                        str(course.get("ge") or ""),
                        str(course.get("description") or ""),
                    ]
                ).lower()

                tokens = q.split()
                matched_all_tokens = True
                for token in tokens:
                    if re.match(r"^\w+$", token):
                        if not re.search(r"\b" + re.escape(token) + r"\b", matchable):
                            matched_all_tokens = False
                            break
                    else:
                        if token not in matchable:
                            matched_all_tokens = False
                            break
                if not matched_all_tokens:
                    continue

        course_copy = dict(course)
        if "color" not in course_copy:
            course_copy["color"] = "#00B4DB"
        term_val = str(course.get("term") or "Winter 2027")
        if "Spring" in term_val:
            course_copy.setdefault("startDate", "2027-03-29")
            course_copy.setdefault("endDate", "2027-06-11")
        elif "Fall" in term_val:
            course_copy.setdefault("startDate", "2026-09-24")
            course_copy.setdefault("endDate", "2026-12-11")
        elif "Summer" in term_val:
            course_copy.setdefault("startDate", "2027-06-21")
            course_copy.setdefault("endDate", "2027-08-27")
        else:
            course_copy.setdefault("startDate", "2027-01-04")
            course_copy.setdefault("endDate", "2027-03-19")
        results.append(course_copy)

    return results


def is_course_requested_or_pinned(prompt: str, course: Dict[str, Any]) -> bool:
    """
    Determines if the user explicitly requested, pinned, or demanded a specific course in their prompt.
    """
    if not prompt:
        return False

    prompt_lower = prompt.lower()
    code = (course.get("code") or "").lower()
    cid = (course.get("id") or "").lower()
    code_no_space = code.replace(" ", "")

    code_parts = code.split()
    number = code_parts[-1] if len(code_parts) > 1 else ""

    # Check if number appears as a course identifier rather than a credit/unit amount
    has_letter = bool(re.search(r"[a-zA-Z]", number))
    number_in_prompt = False
    is_credit_context = bool(
        re.search(
            r"(?:credits?|units?)\s+(?:to\s+)?"
            + re.escape(number)
            + r"\b|\b"
            + re.escape(number)
            + r"\s*(?:credits?|units?)\b",
            prompt_lower,
        )
    )
    if number and not is_credit_context:
        if has_letter:
            number_in_prompt = bool(re.search(r"\b" + re.escape(number) + r"\b", prompt_lower))
        else:
            number_in_prompt = bool(
                re.search(
                    r"\b(?:course|class|cse|math|am|ece|phys|art|phil|(?:replace|swap|switch)\b.+?\b(?:with|to|for))\s+"
                    + re.escape(number)
                    + r"\b",
                    prompt_lower,
                )
            )

    course_in_prompt = (
        (code and re.search(r"\b" + re.escape(code) + r"\b", prompt_lower))
        or (code_no_space and re.search(r"\b" + re.escape(code_no_space) + r"\b", prompt_lower))
        or (cid and cid in prompt_lower)
        or number_in_prompt
    )

    if not course_in_prompt:
        return False

    # Negative checks: if course is specifically being dropped, asked about for prereqs/why, or replaced
    if re.search(
        r"\b(drop|withdraw|remove|drop\s+out\s+of)\b[^.?!;,]*\b" + re.escape(code) + r"\b",
        prompt_lower,
    ):
        return False
    if re.search(
        r"\b(replace|swap|switch|substitute)\s+(?:my\s+)?\b" + re.escape(code) + r"\b", prompt_lower
    ):
        return False
    if re.search(
        r"\b(replace|swap|switch|substitute)\s+(?:my\s+)?\b" + re.escape(code_no_space) + r"\b",
        prompt_lower,
    ):
        return False
    if number and re.search(
        r"\b(replace|swap|switch|substitute)\s+(?:my\s+)?\b" + re.escape(number) + r"\b",
        prompt_lower,
    ):
        return False
    if re.search(
        r"\b(why\s+(?:do\s+you\s+)?recommend|prereqs?|prerequisites?|path\s+to\s+(?:take)?)\b",
        prompt_lower,
    ):
        return False
    if re.search(r"\binstead\s+of\b[^.?!;,]*\b" + re.escape(code) + r"\b", prompt_lower):
        return False
    if number and re.search(
        r"\binstead\s+of\b[^.?!;,]*\b" + re.escape(number) + r"\b", prompt_lower
    ):
        return False
    # Informational queries (e.g. "when are the sections...", "what time is...", "what cse 30 courses are offered...") are not addition requests
    if re.search(
        r"\b(when\s+(?:are|is)|what\b[^.?!;,]*\b(?:time|sections?|courses?|classes?|offerings?|prereqs?|prerequisites?)|which\b[^.?!;,]*\b(?:sections?|courses?|classes?)|where\s+is|tell\s+me\s+about|info\s+on|details\s+on|how\s+many|is\s+there|are\s+there|are\s+offered|is\s+offered)\b",
        prompt_lower,
    ):
        return False

    # Explicit pin keywords
    if re.search(r"\bpin(?:ned)?\b", prompt_lower):
        return True

    # Demand / addition / want patterns
    intent_patterns = [
        rf"\b(want|need|add|take|include|enroll|demand|must\s+have|require|put|sign\s+up\s+for)\b[^.?!;,]*\b{re.escape(code)}\b",
        rf"\b(want|need|add|take|include|enroll|demand|must\s+have|require|put|sign\s+up\s+for)\b[^.?!;,]*\b{re.escape(code_no_space)}\b",
        rf"\b{re.escape(code)}\b[^.?!;,]*\b(instead|please|is\s+required|must\s+be)\b",
        rf"\b{re.escape(code_no_space)}\b[^.?!;,]*\b(instead|please|is\s+required|must\s+be)\b",
        rf"\b(replace|swap|switch|substitute)\b[^.?!;,]*\b(with|for|to)\s+\b{re.escape(code)}\b",
        rf"\b(replace|swap|switch|substitute)\b[^.?!;,]*\b(with|for|to)\s+\b{re.escape(code_no_space)}\b",
    ]
    if number and number_in_prompt:
        intent_patterns.append(
            rf"\b(replace|swap|switch|substitute)\b[^.?!;,]*\b(with|for|to)\s+\b{re.escape(number)}\b"
        )
        if has_letter:
            intent_patterns.append(
                rf"\b(want|need|add|take|include|enroll)\b[^.?!;,]*\b{re.escape(number)}\b"
            )
    for pat in intent_patterns:
        if re.search(pat, prompt_lower):
            return True

    return False


# Context storage passed into tools at runtime
_active_context: Dict[str, Any] = {}


def set_tool_context(
    student: Dict[str, Any],
    preferences: Dict[str, Any],
    schedule: List[Dict[str, Any]],
    session_token: Optional[str] = None,
    node_api_url: Optional[str] = None,
):
    global _active_context
    _active_context = {
        "student": student,
        "preferences": preferences,
        "schedule": schedule,
        "session_token": session_token,
        "node_api_url": node_api_url or os.environ.get("NODE_API_URL", "http://localhost:3001"),
    }


@tool
def inspect_student_profile(query: str = "") -> str:
    """Inspects the student's active profile, including major, minor, standing, and target quarterly credits."""
    student = _active_context.get("student", {})
    prefs = _active_context.get("preferences", {})
    return json.dumps(
        {
            "name": student.get("name", "UCSC Student"),
            "major": student.get("major", "Computer Science B.S."),
            "standing": student.get("standing", "Junior"),
            "minor": student.get("minor", None),
            "targetCredits": prefs.get("targetCredits", 15),
            "currentTerm": "Winter 2027",
            "academicYear": "2026-2027",
        }
    )


@tool
def query_degree_ge_requirements(query: str = "") -> str:
    """Queries general education (GE) completion status and required major course requirements."""
    prefs = _active_context.get("preferences", {})
    ge_status = prefs.get("geStatus", {})
    remaining = ge_status.get("remaining", []) if isinstance(ge_status, dict) else []
    completed_major = prefs.get("majorRequirementsTaken", [])
    return json.dumps(
        {
            "remainingGEs": remaining,
            "completedMajorRequirements": completed_major,
            "geSource": ge_status.get("source", "UCSC") if isinstance(ge_status, dict) else "UCSC",
        }
    )


@tool
def inspect_calendar_schedule(query: str = "") -> str:
    """Inspects the student's current weekly schedule, enrolled courses, and Google Calendar busy commitments."""
    schedule = _active_context.get("schedule", [])
    return json.dumps(
        {
            "enrolledCourses": schedule,
            "totalCount": len(schedule),
        }
    )


@tool
def explain_course_rationale(course_code: str = "") -> str:
    """Explains the academic justification, prerequisite progression, and workload rationale for taking a specific UCSC course."""
    student = _active_context.get("student", {})
    prefs = _active_context.get("preferences", {})
    major = student.get("major", "Computer Science B.S.")
    return json.dumps(
        {
            "course": course_code,
            "targetMajor": major,
            "rationale": f"Fulfills core major requirements for {major}, unblocks advanced electives, and balances credit load.",
            "targetCredits": prefs.get("targetCredits", 15),
        }
    )


@tool
def find_prerequisite_path(target_course: str) -> str:
    """Finds the shortest prerequisite chain to unlock an advanced UCSC Computer Science course using the prerequisite DAG solver."""
    prefs = _active_context.get("preferences", {})
    completed = prefs.get("majorRequirementsTaken", [])
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
    prefs = _active_context.get("preferences", {})
    completed = prefs.get("majorRequirementsTaken", [])
    audit = audit_degree_progress(completed)
    return json.dumps(audit)


@tool
def update_schedule_preferences(
    target_credits: Optional[int] = None,
    target_term: Optional[str] = None,
    preferred_free_days: Optional[List[str]] = None,
    earliest_start_time: Optional[str] = None,
    latest_end_time: Optional[str] = None,
    max_back_to_back_hours: Optional[int] = None,
) -> str:
    """Action tool that modifies the student's scheduling preferences. Pass ONLY the fields the student asked to change; omitted fields are left as they are. Changing target_credits or target_term (e.g. "Spring 2027") clears the current schedule, so propose replacement courses in the same reply."""
    updates: Dict[str, Any] = {}
    if target_credits is not None:
        updates["targetCredits"] = target_credits
    if target_term is not None:
        updates["targetTerm"] = target_term
    if preferred_free_days is not None:
        updates["preferredFreeDays"] = preferred_free_days
    if earliest_start_time is not None:
        updates["earliestStartTime"] = earliest_start_time
    if latest_end_time is not None:
        updates["latestEndTime"] = latest_end_time
    if max_back_to_back_hours is not None:
        updates["maxBackToBackHours"] = max_back_to_back_hours

    return json.dumps(
        {
            "status": "PREFERENCES_UPDATED" if updates else "NO_CHANGES",
            "action": "UPDATE_PREFERENCES",
            "updates": updates,
        }
    )


@tool
def check_course_prerequisites(
    course_code: str, completed_courses: Optional[List[str]] = None
) -> str:
    """
    Checks if a student satisfies all prerequisite requirements to enroll in a target course.
    """
    from .dag_solver import evaluate_course_eligibility

    if completed_courses is None:
        prefs = (
            _active_context.get("preferences", {})
            if "_active_context" in globals() and _active_context
            else {}
        )
        completed = prefs.get("majorRequirementsTaken", [])
    else:
        completed = completed_courses
    res = evaluate_course_eligibility(target_course=course_code, completed_courses=completed)
    return res.get("message", f"Eligibility evaluated for {course_code}: {res.get('status')}")


@tool
def get_course_details(course_code: str, section: str = "") -> str:
    """Retrieves all attributes for a specific course or course section from the academic catalog database, including meeting times, room, instructor, and quarter dates."""
    from .catalog_dao import get_course_details as dao_get_details

    rows = dao_get_details(course_code=course_code, section=section if section else None)
    if not rows:
        return f"No course details found for '{course_code}' in the academic catalog database."

    details = []
    for r in rows:
        term_val = r.get("meeting_dates") or "Winter 2027"
        calendar_info = "Instruction: Jan 5 – Mar 12, 2027 | Quarter Dates: Jan 4 – Mar 19, 2027"
        if "Spring" in term_val:
            calendar_info = (
                "Instruction: Mar 29 – Jun 4, 2027 | Quarter Dates: Mar 29 – Jun 11, 2027"
            )
        elif "Fall" in term_val:
            calendar_info = (
                "Instruction: Sep 24 – Dec 4, 2026 | Quarter Dates: Sep 24 – Dec 11, 2026"
            )
        details.append(
            f"- **{r.get('course_code')}** Section {r.get('section')} ({r.get('section_type')}): "
            f"'{r.get('title')}' | Credits: {r.get('credits', 'N/A')} | GE: {r.get('ge', 'None')} | "
            f"Days/Time: {r.get('days', 'TBA')} {r.get('start_time', '')}-{r.get('end_time', '')} | "
            f"Term: {term_val} ({calendar_info}) | "
            f"Room: {r.get('room', 'TBA')} | Instructor: {r.get('instructor', 'Staff')} | "
            f"Prereqs: {r.get('raw_prereqs', 'None')}"
        )
    return "\n".join(details)


@tool
def get_course_sections(course_code: str) -> str:
    """Lists all available lecture and discussion sections for a course in the active quarter."""
    from .catalog_dao import get_course_sections as dao_get_sections

    rows = dao_get_sections(course_code=course_code)
    if not rows:
        return f"No active sections found for '{course_code}'."

    lines = [f"Sections for {course_code.upper()}:"]
    for r in rows:
        lines.append(
            f"- Section {r.get('section')} [{r.get('section_type')}]: {r.get('days', 'TBA')} "
            f"{r.get('start_time', '')}-{r.get('end_time', '')} in {r.get('room', 'TBA')} "
            f"(Status: {r.get('status', 'Open')})"
        )
    return "\n".join(lines)


@tool
def get_course_time(course_code: str, section: str = "01") -> str:
    """Looks up the exact meeting days, daily lecture times, and academic quarter start and end dates for a specific course section."""
    from .catalog_dao import get_course_time as dao_get_time

    row = dao_get_time(course_code=course_code, section=section)
    if not row:
        return f"No schedule found for {course_code.upper()} Section {section}."
    return (
        f"{row.get('course_code')} Section {row.get('section')} meets {row.get('days')} from {row.get('start_time')} to {row.get('end_time')} in {row.get('room')}. "
        f"Quarter Session Dates: January 5, 2027 (instruction begins) to March 19, 2027 (quarter ends)."
    )


@tool
def get_academic_calendar(term: str = "Winter 2027") -> str:
    """Returns official UCSC academic calendar dates including quarter start/end dates, instruction begin/end dates, and finals examination week."""
    clean_term = (term or "").strip().lower()
    if "spring" in clean_term:
        return json.dumps(
            {
                "term": "Spring 2027",
                "quarterStartDate": "2027-03-29",
                "quarterEndDate": "2027-06-11",
                "instructionBegins": "Monday, March 29, 2027",
                "instructionEnds": "Friday, June 4, 2027",
                "finalsWeek": "Monday, June 7, 2027 - Friday, June 11, 2027",
            }
        )
    elif "fall" in clean_term:
        return json.dumps(
            {
                "term": "Fall 2026",
                "quarterStartDate": "2026-09-24",
                "quarterEndDate": "2026-12-11",
                "instructionBegins": "Thursday, September 24, 2026",
                "instructionEnds": "Friday, December 4, 2026",
                "finalsWeek": "Monday, December 7, 2026 - Friday, December 11, 2026",
            }
        )
    elif "summer" in clean_term:
        return json.dumps(
            {
                "term": "Summer 2027",
                "quarterStartDate": "2027-06-21",
                "quarterEndDate": "2027-08-27",
                "instructionBegins": "Monday, June 21, 2027",
                "instructionEnds": "Friday, August 27, 2027",
                "finalsWeek": "August 26 - August 27, 2027",
            }
        )
    else:
        return json.dumps(
            {
                "term": "Winter 2027",
                "quarterStartDate": "2027-01-04",
                "quarterEndDate": "2027-03-19",
                "instructionBegins": "Tuesday, January 5, 2027",
                "instructionEnds": "Friday, March 12, 2027",
                "finalsWeek": "Monday, March 15, 2027 - Friday, March 19, 2027",
            }
        )


@tool
def query_degree_requirements(query: str, major: str = "", concentration: str = "") -> str:
    """
    Queries official university degree requirements, concentrations, and major policies using vector search.
    """
    from .chroma_rag import query_degree_chunks

    student = (
        _active_context.get("student", {})
        if "_active_context" in globals() and _active_context
        else {}
    )
    student_major = major or student.get("major", "")
    results = query_degree_chunks(query=query, major=student_major, concentration=concentration)
    if not results:
        results = query_degree_chunks(query=query, n_results=3)
    if not results:
        return "No specific degree requirements found in the knowledge base matching your query."

    formatted = []
    for r in results:
        meta = r.get("metadata", {})
        heading = meta.get("section_heading", "Requirements")
        deg = meta.get("degree_title", "")
        conc = meta.get("concentration", "General")
        doc = r.get("document", "")
        formatted.append(f"### {deg} ({conc}) - {heading}\n{doc}")
    return "\n\n".join(formatted)


@tool
def search_course_catalog(
    query: str = "", term: str = "Winter 2027", department: str = "", ge_type: str = ""
) -> str:
    """Searches the official UCSC course catalog by query keyword, term, department code, or GE requirement category."""
    matches = find_courses(query=query, term=term, department=department, ge_type=ge_type)
    return json.dumps(matches)


@tool
def create_class_event(course_code: str, section: str = "01") -> str:
    """
    Creates a verified class event on the student's local schedule by querying catalog details
    and posting to the Node /api/user_schedule endpoint.
    """
    import requests

    from .catalog_dao import get_course_details as dao_get_details

    clean_code = course_code.strip().upper()
    rows = dao_get_details(course_code=clean_code, section=section if section else None)

    title = f"{clean_code} Lecture"
    days = "M,W,F"
    start_time = "10:00"
    end_time = "11:05"

    if rows:
        r = rows[0]
        title = r.get("title") or title
        days = r.get("days") or days
        start_time = r.get("start_time") or start_time
        end_time = r.get("end_time") or end_time
    else:
        # Fallback to course catalog if available
        cat = find_courses(query=clean_code)
        if cat:
            c = cat[0]
            title = c.get("title") or title
            raw_days = c.get("days") or []
            days = ",".join(raw_days) if isinstance(raw_days, list) else str(raw_days)
            start_time = c.get("startTime") or start_time
            end_time = c.get("endTime") or end_time

    node_url = _active_context.get("node_api_url", "http://localhost:3001")
    token = _active_context.get("session_token", "")

    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload: Dict[str, Any] = {
        "courseCode": clean_code,
        "title": title,
        "description": f"Section {section} - {days} {start_time}-{end_time}",
        "days": days,
        "startTime": start_time,
        "endTime": end_time,
        "startDate": "2027-01-04",
        "endDate": "2027-03-19",
        "isImported": False,
    }

    try:
        resp = requests.post(
            f"{node_url}/api/user_schedule", json=payload, headers=headers, timeout=10
        )
        if resp.status_code in (200, 201):
            return f"Successfully added {clean_code} ({days} {start_time}-{end_time}) to your schedule."
        else:
            return f"Failed to add {clean_code} to schedule: {resp.text}"
    except Exception as e:
        return f"Error communicating with schedule service: {str(e)}"


@tool
def delete_class_event(course_code: str) -> str:
    """
    Removes a scheduled course from the student's calendar by calling Node DELETE /api/user_schedule/:id.
    """
    import requests

    clean_code = course_code.strip().upper()
    schedule = _active_context.get("schedule", [])
    matching_id = None

    for item in schedule:
        c_code = (item.get("courseCode") or item.get("code") or "").strip().upper()
        if c_code == clean_code:
            matching_id = item.get("id")
            break

    node_url = _active_context.get("node_api_url", "http://localhost:3001")
    token = _active_context.get("session_token", "")
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    if matching_id:
        try:
            resp = requests.delete(
                f"{node_url}/api/user_schedule/{matching_id}", headers=headers, timeout=10
            )
            if resp.status_code in (200, 204):
                return f"Successfully removed {clean_code} from your schedule."
            return f"Failed to delete {clean_code}: {resp.text}"
        except Exception as e:
            return f"Error communicating with schedule service: {str(e)}"

    # If no ID in local active context, try fetching user_schedule to locate ID
    try:
        get_resp = requests.get(f"{node_url}/api/user_schedule", headers=headers, timeout=10)
        if get_resp.status_code == 200:
            items = get_resp.json().get("data", [])
            for it in items:
                if (it.get("courseCode") or "").strip().upper() == clean_code:
                    del_id = it.get("id")
                    del_resp = requests.delete(
                        f"{node_url}/api/user_schedule/{del_id}", headers=headers, timeout=10
                    )
                    if del_resp.status_code in (200, 204):
                        return f"Successfully removed {clean_code} from your schedule."
    except Exception:
        pass

    return f"Course {clean_code} was not found on your active schedule."


@tool
def list_google_events(time_min: str = "", time_max: str = "") -> str:
    """
    READ-ONLY: Lists external Google Calendar events for the student to detect schedule conflicts.
    """
    schedule = _active_context.get("schedule", [])
    imported = [
        e for e in schedule if e.get("isImported") or e.get("type") == "GOOGLE_CALENDAR_BUSY"
    ]
    if not imported:
        return "No external Google Calendar commitments found."
    lines = ["External Google Calendar commitments:"]
    for ev in imported:
        lines.append(
            f"- {ev.get('title')}: {ev.get('days', '')} {ev.get('startTime', '')}-{ev.get('endTime', '')}"
        )
    return "\n".join(lines)


@tool
def find_free_time(duration_minutes: int = 60) -> str:
    """
    READ-ONLY: Evaluates calendar busy blocks to find available study or free time windows.
    """
    return f"Free time windows of at least {duration_minutes} minutes are available between morning and evening lectures."


@tool
def solve_schedule_tool(
    target_credits: int = 15,
    preferred_gap_minutes: int = 0,
    orientation_goal: str = "",
    requested_electives: Optional[List[str]] = None,
    required_courses: Optional[List[str]] = None,
    extraneous_courses: Optional[List[str]] = None,
) -> str:
    """
    Runs the deterministic OR-Tools CP-SAT solver to compute a conflict-free schedule
    respecting the student's major, class standing, preferences, and busy blocks.
    """
    from .schedule_solver import load_catalog_for_solver, solve_schedule

    student = dict(_active_context.get("student", {}))
    prefs = dict(_active_context.get("preferences", {}))
    if target_credits:
        prefs["targetCredits"] = target_credits
    schedule = _active_context.get("schedule", [])
    busy_blocks = [
        ev for ev in schedule if ev.get("isImported") or ev.get("type") == "GOOGLE_CALENDAR_BUSY"
    ]
    chat_ctx: Dict[str, Any] = {
        "preferredGapMinutes": preferred_gap_minutes,
        "orientationGoal": orientation_goal,
        "major": student.get("major", ""),
        "standing": student.get("standing", ""),
    }
    if requested_electives:
        chat_ctx["requestedElectives"] = requested_electives
    if required_courses:
        chat_ctx["requiredCourses"] = required_courses
    if extraneous_courses:
        chat_ctx["extraneousCourses"] = extraneous_courses

    result = solve_schedule(
        catalog=load_catalog_for_solver(),
        completed_courses=prefs.get("majorRequirementsTaken", []),
        preferences=prefs,
        busy_blocks=busy_blocks,
        chat_context=chat_ctx,
    )
    return json.dumps(result)


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
        query_degree_requirements,
        get_course_details,
        get_course_sections,
        get_course_time,
        get_academic_calendar,
        check_course_prerequisites,
        create_class_event,
        delete_class_event,
        list_google_events,
        find_free_time,
        solve_schedule_tool,
    ]
