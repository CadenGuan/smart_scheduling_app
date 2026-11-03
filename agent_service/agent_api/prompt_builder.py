from typing import List, Dict, Any

def build_system_prompt(student: Dict[str, Any], preferences: Dict[str, Any], current_schedule: List[Dict[str, Any]]) -> str:
    """
    Constructs a rich system prompt that equips the agent with student degree context,
    onboarding preferences, and current calendar commitments.
    """
    name = student.get('name', 'UCSC Student')
    major = student.get('major', 'Computer Science B.S.')
    standing = student.get('standing', 'Junior')
    minor = student.get('minor') or 'None'

    target_credits = preferences.get('targetCredits', 15)
    ge_status = preferences.get('geStatus', {})
    remaining_ges = ge_status.get('remaining', []) if isinstance(ge_status, dict) else []
    ge_source = ge_status.get('source', 'UCSC') if isinstance(ge_status, dict) else 'UCSC'
    major_reqs_taken = preferences.get('majorRequirementsTaken', [])
    breaks = preferences.get('breaksPreference', [])

    preferred_free_days = preferences.get('preferredFreeDays', [])
    earliest_start = preferences.get('earliestStartTime')
    latest_end = preferences.get('latestEndTime')
    max_b2b = preferences.get('maxBackToBackHours')

    time_constraints = []
    if preferred_free_days:
        time_constraints.append(f"Preferred Free Days: {', '.join(preferred_free_days)}")
    if earliest_start:
        time_constraints.append(f"Earliest Start Time: {earliest_start}")
    if latest_end:
        time_constraints.append(f"Latest End Time: {latest_end}")
    if max_b2b:
        time_constraints.append(f"Max Back-to-Back Hours: {max_b2b}h")

    courses_summary = []
    for event in current_schedule:
        title = event.get('title', 'Unknown Course')
        days = ", ".join(event.get('days', []))
        start = event.get('startTime', '')
        end = event.get('endTime', '')
        etype = event.get('type', 'COURSE')
        courses_summary.append(f"- {title} ({days} {start}-{end}) [{etype}]")

    courses_text = "\n".join(courses_summary) if courses_summary else "No courses currently placed on schedule."

    system_prompt = f"""You are **Sammy the Slug Scheduling Advisor**, an autonomous academic planning assistant for University of California, Santa Cruz (UCSC) students.
You specialize in UCSC degree requirements, Baskin School of Engineering major paths, General Education (GE) fulfillment, and weekly schedule optimization.

### Student Profile:
- **Name:** {name}
- **Standing:** {standing}
- **Major:** {major}
- **Minor:** {minor}
- **Target Quarterly Credits:** {target_credits}

### Onboarding & Degree Constraints:
- **GE Completion Source:** {ge_source}
- **Remaining / Unmet GE Categories:** {', '.join(remaining_ges) if remaining_ges else 'All GEs satisfied or none specified'}
- **Major Requirements Completed:** {', '.join(major_reqs_taken) if major_reqs_taken else 'None marked yet'}
- **Scheduled Time Breaks / Work Commitments:** {len(breaks)} registered break window(s)
{f"- **Schedule Preferences:** {'; '.join(time_constraints)}" if time_constraints else ""}

### Current Weekly Calendar Schedule:
{courses_text}

### Instructions for Sammy:
1. Provide concise, friendly, and highly actionable advice tailored specifically to UCSC course numbers and degree requirements.
2. When referencing courses, format them in backticks (e.g. `CSE 115A`, `CSE 101`, `MATH 21`, `ART 10F`).
3. Whenever recommending, proposing, or adjusting courses for a schedule, you MUST search the official UCSC course catalog using the `search_course_catalog` tool to inspect real course sections with authentic meeting days, times, instructors, and credit counts.
4. Never invent, hallucinate, or assume lecture times, meeting days, or course IDs. Always ground your course proposals in real catalog data returned by `search_course_catalog`.
5. Clearly specify recommended course IDs, titles, and meeting patterns so they can be accurately scheduled.
6. Take into account the student's remaining GEs, completed major prerequisites, and target credit goals when selecting candidate courses.
7. If the student has time conflicts or busy commitments (such as Google Calendar blocks or dining hall shifts), advise against overlapping courses.
8. If the student explicitly demands or requests a specific course (e.g. "I want CSE 130"), prioritize and include that course as requested.
9. Always format responses in clean GitHub-flavored Markdown using bold headings, bulleted lists, and clear paragraphs.
10. When asked 'why' or asked to justify a recommendation, explain your reasoning transparently: cite prerequisite progression unblocked, workload balance across programming assignments, GE requirement fulfillment, or avoiding back-to-back schedule fatigue.
11. Reference previous discussion turns in the conversation when appropriate so returning students do not have to repeat themselves.
"""
    return system_prompt.strip()

def format_history_messages(history: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """
    Normalizes historical messages into a list of {role, content} objects.
    """
    formatted = []
    for msg in history:
        sender = msg.get('sender', 'USER').upper()
        content = msg.get('content', '')
        role = 'user' if sender == 'USER' else 'assistant'
        formatted.append({'role': role, 'content': content})
    return formatted
