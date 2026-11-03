import re
from typing import Dict, Any, List
from .dag_solver import get_prerequisite_chain, get_downstream_impact, audit_degree_progress
from .tools import find_courses, get_course_catalog, is_course_requested_or_pinned

def run_mock_agent(
    prompt: str,
    student: Dict[str, Any],
    preferences: Dict[str, Any],
    schedule: List[Dict[str, Any]],
    history: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Deterministic mock agent for offline development and automated testing.
    Produces rich, personalized UCSC advising responses without requiring external LLM API calls.
    Supports multi-turn memory recall, recommendation rationale, NetworkX DAG prerequisite pathfinding,
    conversational preference updating, and calendar export instructions.
    """
    prompt_lower = prompt.lower()
    name = student.get('name', 'Slug')
    major = student.get('major', 'Computer Science B.S.')
    standing = student.get('standing', 'Junior')

    ge_status = preferences.get('geStatus', {})
    remaining_ges = ge_status.get('remaining', []) if isinstance(ge_status, dict) else []
    completed_major = preferences.get('majorRequirementsTaken', [])
    target_credits = preferences.get('targetCredits', 15)

    tool_calls_simulated = []
    proposed_courses = []

    term_match = re.search(r'\b(Winter|Spring|Summer|Fall)\s+\d{4}\b', prompt, re.IGNORECASE)
    term = term_match.group(0).title() if term_match else "Winter 2027"

    catalog = get_course_catalog()

    # Identify any pinned or explicitly requested courses in the prompt
    pinned_courses = []
    for c in catalog:
        if is_course_requested_or_pinned(prompt, c):
            c_copy = dict(c)
            c_copy['pinned'] = True
            pinned_courses.append(c_copy)

    # Scenario 0: Explicit Course Addition / Pinning Request
    if pinned_courses:
        pinned_codes = [f"`{c.get('code')}`" for c in pinned_courses]

        complementary = []
        for default_code in ['CSE 115A', 'CSE 101', 'CSE 130', 'ART 10F', 'PHIL 11']:
            if not any(pc.get('code') == default_code for pc in pinned_courses):
                matches = find_courses(query=default_code, term=term)
                if matches:
                    comp = dict(matches[0])
                    comp['pinned'] = False
                    complementary.append(comp)

        proposed_courses = list(pinned_courses) + complementary[:4]

        tool_calls_simulated.append({
            'tool': 'search_course_catalog',
            'args': {'query': pinned_courses[0].get('code', ''), 'term': term},
            'output': [c['id'] for c in proposed_courses],
        })

        details_list = []
        for pc in pinned_courses:
            days_str = ", ".join(pc.get('days', []))
            details_list.append(
                f"- **`{pc.get('code')}` ({pc.get('title')})**: {days_str} {pc.get('startTime')}-{pc.get('endTime')} ({pc.get('credits')} credits) in {pc.get('location')}"
            )
        details_text = "\n".join(details_list)

        response = (
            f"I have added {', '.join(pinned_codes)} to your proposed schedule and pinned {'them' if len(pinned_courses) > 1 else 'it'} as requested! 📌\n\n"
            f"### Pinned Course Details:\n"
            f"{details_text}\n\n"
            f"I also queried the {term} catalog for complementary major requirements and GEs to balance your workload towards your **{target_credits}-credit** goal. "
            f"Your weekly preview grid has been refreshed with zero time conflicts!"
        )

    # Scenario 1: Calendar Export (Sprint 4 Priority 5 User Story)
    elif 'export' in prompt_lower or 'download schedule' in prompt_lower or '.ics' in prompt_lower or 'google calendar' in prompt_lower or 'apple calendar' in prompt_lower:
        response = (
            f"You can easily export your planned schedule into standard RFC 5545 `.ics` format! 🗓️\n\n"
            f"### How to Export Your Calendar:\n"
            f"1. Click the **'📥 Export .ics'** button in the header bar of your Weekly Schedule Preview.\n"
            f"2. Your browser will download `slug-schedule-winter-2027.ics` directly.\n"
            f"3. Open your preferred app (Google Calendar, Apple Calendar, or Outlook) and import the downloaded `.ics` file.\n\n"
            f"💡 **Built-In Alerts:** All class meetings include **15-minute reminders**, and academic milestones (like Add/Drop and Finals) come with **1-day advance alarms**!"
        )

    # Scenario 1.5: Research & Academic Conference Deadlines (Product Backlog Item 2)
    elif any(k in prompt_lower for k in ['conference', 'research', 'deadline', 'symposium', 'publish', 'call for papers', 'cfp']):
        tool_calls_simulated.append({
            'tool': 'query_conference_deadlines',
            'output': {
                'recommendedVenues': ['UCSC URS', 'ICSE SRC', 'SIGCSE', 'OSDI', 'NeurIPS'],
                'targetAudience': 'UCSC CS Undergraduates & Researchers',
            }
        })
        response = (
            f"Here are the key academic conference and undergraduate research deadlines to keep on your radar! 🎯\n\n"
            f"### High-Impact Opportunities for UCSC CS Students:\n"
            f"1. **UCSC Undergraduate Research Symposium (URS)** – *Early May 2027* (Abstracts Due April 15). Fantastic local venue to showcase capstone projects or senior theses.\n"
            f"2. **ACM SIGCSE Technical Symposium (Student Research Track)** – *Early March 2027*. Ideal for CS education and curriculum tooling research.\n"
            f"3. **ICSE Student Research Competition (SRC)** – *Late May 2027*. Flagship software engineering venue for student innovations.\n"
            f"4. **USENIX OSDI & NeurIPS** – Tier-1 premier venues for systems design and machine learning.\n\n"
            f"💡 **Sync to Your Calendar:** Click the **'🎯 Deadlines'** button in your schedule header to filter by research topic or click **'Export Deadlines .ics'** to load them into your calendar!"
        )

    # Scenario 2: Dropping a Course Impact (Sprint 3 Priority 3 User Story)
    elif 'drop' in prompt_lower or 'withdraw' in prompt_lower:
        course_hint = "CSE 101"
        for code in ['cse 101', 'cse 115a', 'cse 130', 'cse 13s', 'cse 12', 'cse 16', 'math 19b']:
            if code in prompt_lower:
                course_hint = code.upper()
                break

        impact = get_downstream_impact(course_hint)
        tool_calls_simulated.append({
            'tool': 'assess_drop_impact',
            'output': impact,
        })

        imm_str = ", ".join([f"`{c}`" for c in impact['immediateBlocked']]) if impact['immediateBlocked'] else "none"
        total_count = impact['totalBlockedCount']
        
        response = (
            f"Here is the downstream degree audit if you drop **`{course_hint}`**: ⚠️\n\n"
            f"- **Immediately Blocked:** {imm_str}\n"
            f"- **Total Future Delayed Courses:** **{total_count} requirement(s)**\n\n"
            f"{'🚨 **Critical Gatekeeper Warning:** Because this course unlocks essential capstone sequences, dropping it will delay your graduation by at least one quarter.' if impact['isGatekeeper'] else 'This drop will not derail core prerequisites, but you will need to replace the units.'}\n\n"
            f"If you are feeling overwhelmed, we can reduce your non-major workload instead of dropping `{course_hint}`!"
        )

    # Scenario 3: Prerequisite Pathfinding via NetworkX DAG (Sprint 3 Priority 5 User Story)
    elif 'prereq' in prompt_lower or 'path' in prompt_lower or 'how do i get to' in prompt_lower or 'how to take' in prompt_lower or 'unlock' in prompt_lower:
        target_course = "CSE 130"
        for code in ['cse 130', 'cse 115a', 'cse 115b', 'cse 180', 'cse 101', 'cse 102', 'cse 103', 'cse 150', 'cse 185s']:
            if code in prompt_lower:
                target_course = code.upper()
                break

        chain = get_prerequisite_chain(target_course, completed_major)
        tool_calls_simulated.append({
            'tool': 'find_prerequisite_path',
            'output': chain,
        })

        if chain['status'] == 'READY_TO_ENROLL':
            response = (
                f"🎉 Great news! You have already satisfied all prerequisites for **`{target_course}`**! "
                f"You are eligible to place it on your schedule next quarter."
            )
        elif chain['status'] == 'ALREADY_COMPLETED':
            response = f"You have already completed **`{target_course}`** in a prior quarter!"
        else:
            needed = ", ".join([f"`{c}`" for c in chain['unmetPrerequisites']])
            quarters = chain['criticalPathQuarters']
            response = (
                f"### Shortest Prerequisite Path to `{target_course}`: 🗺️\n\n"
                f"Based on your completed coursework ({', '.join(completed_major) if completed_major else 'none yet'}), "
                f"you need to complete **{len(chain['unmetPrerequisites'])} course(s)** before enrolling in `{target_course}`:\n\n"
                f"- **Prerequisite Sequence:** {needed}\n"
                f"- **Minimum Timeline:** Approximately **{quarters} quarter(s)** along your critical degree path.\n\n"
                f"Prioritizing `{chain['unmetPrerequisites'][0] if chain['unmetPrerequisites'] else 'the next foundation'}` next quarter will unblock this path fastest."
            )

    # Scenario 4: Workload Overload / "This is too much" (Sprint 3 Priority 3 User Story)
    elif 'too much' in prompt_lower or 'heavy' in prompt_lower or 'lighten' in prompt_lower or 'overwhelm' in prompt_lower or 'burnout' in prompt_lower:
        new_target = 10 if target_credits <= 12 else 12
        tool_calls_simulated.append({
            'tool': 'update_schedule_preferences',
            'output': {
                'action': 'UPDATE_PREFERENCES',
                'updates': {'targetCredits': new_target},
            }
        })
        light_courses = []
        for code in ['CSE 101', 'ART 10F']:
            matches = find_courses(query=code, term=term)
            if matches:
                c_copy = dict(matches[0])
                c_copy['pinned'] = False
                light_courses.append(c_copy)
        proposed_courses = light_courses
        tool_calls_simulated.append({
            'tool': 'search_course_catalog',
            'args': {'query': 'lightened', 'term': term},
            'output': [c['id'] for c in proposed_courses],
        })
        response = (
            f"I hear you! Pacing yourself is essential for maintaining strong GPA and mental well-being at UCSC. 💙\n\n"
            f"I have automatically adjusted your target credit preference from **{target_credits} credits** down to **{new_target} credits**.\n\n"
            f"### Sammy's Lightened Schedule Proposal:\n"
            f"- Keep **1 primary core programming lab** (e.g. `CSE 101` or `CSE 115A`)\n"
            f"- Pair it with **1 lighter general education course** (e.g. `PHIL 11` or `ART 10F`)\n"
            f"- Drop the extra 5-unit upper division elective to avoid conflicting final project deadlines.\n\n"
            f"Your schedule preview grid has been refreshed with this balanced pacing!"
        )

    # Scenario 5: Direct Preference Updates in Chat (Sprint 3 Priority 5 User Story)
    elif 'credit' in prompt_lower and any(w in prompt_lower for w in ['change', 'set', 'make', 'update', 'want', '10', '12', '15', '19', '20']):
        credit_match = re.search(r'\b(10|12|14|15|16|17|18|19|20)\b', prompt)
        new_credits = int(credit_match.group(1)) if credit_match else 12
        tool_calls_simulated.append({
            'tool': 'update_schedule_preferences',
            'output': {
                'action': 'UPDATE_PREFERENCES',
                'updates': {'targetCredits': new_credits},
            }
        })
        response = (
            f"Done! ⚙️ I have updated your scheduling preferences to target **{new_credits} credits** for next quarter.\n\n"
            f"Your weekly calendar preview has been re-calculated to match your new unit cap."
        )

    # Scenario 6: Explaining Rationale / "Why" (Sprint 2 Priority 3 User Story)
    elif 'why' in prompt_lower or 'reason' in prompt_lower or 'explain' in prompt_lower or 'rationale' in prompt_lower:
        tool_calls_simulated.append({
            'tool': 'explain_course_rationale',
            'output': {
                'standing': standing,
                'major': major,
                'targetCredits': target_credits,
            }
        })

        course_hint = "CSE 101"
        for code in ['cse 101', 'cse 115a', 'cse 130', 'cse 12', 'cse 16', 'math 21', 'phil 9', 'art 10f']:
            if code in prompt_lower:
                course_hint = code.upper()
                break
        else:
            for h in reversed(history):
                content_lower = h.get('content', '').lower()
                for code in ['cse 101', 'cse 115a', 'cse 130', 'phil 9', 'art 10f']:
                    if code in content_lower:
                        course_hint = code.upper()
                        break

        why_courses = []
        for code in [course_hint, 'CSE 115A', 'ART 10F']:
            matches = find_courses(query=code, term=term)
            if matches:
                c_copy = dict(matches[0])
                c_copy['pinned'] = False
                if not any(wc['id'] == c_copy['id'] for wc in why_courses):
                    why_courses.append(c_copy)
        proposed_courses = why_courses

        response = (
            f"Here is why Sammy recommends **`{course_hint}`** for your plan: 💡\n\n"
            f"1. **Prerequisite Unblocking:** As a **{standing}** in `{major}`, `{course_hint}` is crucial for your degree velocity. Delaying it can bottleneck your upper-division electives.\n"
            f"2. **Workload Balancing:** Pacing this alongside your general education or secondary coursework keeps your schedule within your target **{target_credits} credits** while avoiding excessive coding project overload.\n"
            f"3. **Schedule Feasibility:** The scheduled section slots cleanly into your week without overlapping your external commitments or violating your preferred break windows."
        )

    # Scenario 7: Multi-turn Follow-up / Recall (Sprint 2 Priority 8 User Story)
    elif any(phrase in prompt_lower for phrase in ['tell me more', 'elaborate', 'what else', 'as i said', 'earlier', 'previous']) and len(history) > 0:
        last_agent_msg = next((h.get('content', '') for h in reversed(history) if h.get('sender') == 'AGENT'), None)
        topic_context = "our previous degree planning topic"
        if last_agent_msg:
            if "GE" in last_agent_msg or "General Education" in last_agent_msg:
                topic_context = "your General Education options"
            elif "CSE" in last_agent_msg:
                topic_context = "your core Computer Science coursework"
            elif "schedule" in last_agent_msg or "calendar" in last_agent_msg:
                topic_context = "your weekly calendar layout"

        response = (
            f"Continuing from what we discussed regarding **{topic_context}**: 🔄\n\n"
            f"As a {standing} in `{major}`, you also have the flexibility to adjust your quarterly pacing. "
            f"Would you like me to look for alternative lecture times, explore secondary electives, or verify that your graduation timeline stays on track?"
        )

    # Scenario 8: Returning User Greeting (Sprint 2 Priority 5 User Story)
    elif ('hello' in prompt_lower or 'hi' in prompt_lower or 'hey' in prompt_lower) and len(history) > 0:
        response = (
            f"Welcome back, {name}! 🐌 Great to see you again.\n\n"
            f"I still have your record on file (**{standing}** in `{major}` aiming for **{target_credits} credits**). "
            f"What would you like to check or adjust in your schedule today?"
        )

    # Scenario 9: Inquiring about GE requirements
    elif 'ge' in prompt_lower or 'general ed' in prompt_lower or 'requirement' in prompt_lower:
        tool_calls_simulated.append({
            'tool': 'query_degree_ge_requirements',
            'output': {'remaining': remaining_ges}
        })
        ge_candidates = []
        target_ges = remaining_ges if remaining_ges else ['CC', 'ER', 'PR-C']
        for g in target_ges:
            matches = find_courses(ge_type=g, term=term)
            if matches:
                m_copy = dict(matches[0])
                m_copy['pinned'] = False
                if not any(gc['id'] == m_copy['id'] for gc in ge_candidates):
                    ge_candidates.append(m_copy)

        for m_code in ['CSE 115A', 'CSE 101']:
            m_matches = find_courses(query=m_code, term=term)
            if m_matches:
                m_copy = dict(m_matches[0])
                m_copy['pinned'] = False
                if not any(gc['id'] == m_copy['id'] for gc in ge_candidates):
                    ge_candidates.append(m_copy)

        proposed_courses = ge_candidates

        tool_calls_simulated.append({
            'tool': 'search_course_catalog',
            'args': {'term': term, 'ge_type': ', '.join(remaining_ges) if remaining_ges else 'GE'},
            'output': [c['id'] for c in proposed_courses],
        })

        if remaining_ges:
            ge_list = ", ".join([f"`{g}`" for g in remaining_ges])
            response = (
                f"Hey {name}! 🐌 Based on your degree progress, you currently have the following **General Education (GE)** requirements remaining: {ge_list}.\n\n"
                f"### Recommended UCSC GE Courses for Next Quarter:\n"
                f"- **`PHIL 11` (Critical Thinking)** – Satisfies the `CC` requirement while reinforcing formal proof thinking for upper-division CS.\n"
                f"- **`HIS 10A` (United States History to 1877)** – Satisfies `ER` with structured reading and analytical discussion.\n"
                f"- **`ART 10F` (2D Design)** – Satisfies `PR` with a creative, studio-based workflow to balance heavy coding labs.\n\n"
                f"Pairing one of these with your required major courses will keep you on pace for your **{target_credits}-credit** target without overloading your finals week!"
            )
        else:
            response = (
                f"Great news, {name}! 🎉 Your records show you have already completed or transferred all primary General Education requirements. "
                f"You can focus your elective space entirely on upper-division `{major}` electives or exploratory minor coursework."
            )

    # Scenario 10: Course recommendations
    elif 'cse' in prompt_lower or 'course' in prompt_lower or 'class' in prompt_lower or 'recommend' in prompt_lower or 'major' in prompt_lower or 'schedule' in prompt_lower or any(d in prompt_lower for d in ['math', 'ece', 'film', 'art', 'phil', 'his', 'econ', 'musc', 'astr', 'havc']):
        tool_calls_simulated.append({
            'tool': 'inspect_student_profile',
            'output': {'standing': standing, 'major': major}
        })

        queried_dept = None
        for d in ['MATH', 'ECE', 'FILM', 'ART', 'PHIL', 'HIS', 'ECON', 'MUSC', 'ASTR', 'HAVC']:
            if d.lower() in prompt_lower:
                queried_dept = d
                break

        if queried_dept:
            dept_matches = find_courses(department=queried_dept, term=term)
            proposed_courses = [dict(c, pinned=False) for c in dept_matches]
            tool_calls_simulated.append({
                'tool': 'search_course_catalog',
                'args': {'department': queried_dept, 'term': term},
                'output': [c['id'] for c in proposed_courses],
            })
            offerings = []
            for c in proposed_courses:
                days_str = ", ".join(c.get('days', []))
                offerings.append(
                    f"- **`{c.get('code')}` ({c.get('title')})**: {days_str} {c.get('startTime')}-{c.get('endTime')} ({c.get('credits')} credits) in {c.get('location')}"
                )
            response = (
                f"Here are the active **{queried_dept}** courses available for **{term}**: 📚\n\n"
                f"### Matching Course Offerings:\n"
                + "\n".join(offerings) +
                f"\n\nLet me know which ones you would like to incorporate into your schedule!"
            )
        else:
            recs = []
            for code in ['CSE 115A', 'CSE 130', 'CSE 101', 'ART 10F', 'PHIL 11']:
                matches = find_courses(query=code, term=term)
                if matches:
                    c_copy = dict(matches[0])
                    c_copy['pinned'] = False
                    recs.append(c_copy)

            proposed_courses = recs

            tool_calls_simulated.append({
                'tool': 'search_course_catalog',
                'args': {'department': 'CSE', 'term': term},
                'output': [c['id'] for c in proposed_courses],
            })

            response = (
                f"Here is Sammy's recommended plan for a **{standing}** in `{major}`: 📚\n\n"
                f"### High-Priority Core Courses:\n"
                f"1. **`CSE 101` (Algorithms & Abstract Data Types)** – Critical prerequisite gatekeeper for virtually all upper-division electives.\n"
                f"2. **`CSE 115A` (Intro to Software Engineering)** – Hands-on team project course; excellent preparation for industry internships.\n"
                f"3. **`CSE 130` (Principles of Computer Systems Design)** – Rigorous systems programming covering concurrency, virtual memory, and distributed primitives.\n\n"
                f"💡 **Pro-Tip**: Avoid taking `CSE 101` and `CSE 130` in the exact same quarter unless you have a lighter third course, as both require heavy weekly programming assignments."
            )

    # Scenario 11: Calendar, schedule, conflicts, or breaks
    elif 'calendar' in prompt_lower or 'schedule' in prompt_lower or 'time' in prompt_lower or 'break' in prompt_lower or 'conflict' in prompt_lower:
        tool_calls_simulated.append({
            'tool': 'inspect_calendar_schedule',
            'output': {'eventCount': len(schedule)}
        })
        enrolled_titles = [f"`{e.get('title', 'Class')}`" for e in schedule if e.get('type') != 'GOOGLE_CALENDAR_BUSY']
        busy_blocks = [e for e in schedule if e.get('type') == 'GOOGLE_CALENDAR_BUSY']

        busy_info = f"You also have **{len(busy_blocks)} Google Calendar commitment(s)** (such as work shifts) mapped out." if busy_blocks else "No external calendar conflicts detected."

        response = (
            f"I reviewed your current weekly schedule grid! 🗓️\n\n"
            f"- **Enrolled Classes:** {', '.join(enrolled_titles) if enrolled_titles else 'None yet'}.\n"
            f"- **External Commitments:** {busy_info}\n\n"
            f"Your current schedule maintains clean morning-to-afternoon spacing. Let me know if you would like me to find alternatives with later start times or dedicated study windows!"
        )

    # Default friendly conversational guidance
    else:
        response = (
            f"Hello {name}! 🐌 I am your **SlugAgent Scheduling Advisor**.\n\n"
            f"I can help you:\n"
            f"- Check your remaining **General Education (GE)** categories (`CC`, `ER`, `PR`, etc.)\n"
            f"- Plan your prerequisite pathways for `{major}` using our degree DAG solver\n"
            f"- Assess the downstream graduation impact if you drop a course\n"
            f"- Adjust your quarterly credit targets and preferred break windows\n"
            f"- Export your planned calendar to Google Calendar or Apple Calendar (.ics)\n\n"
            f"What would you like to explore for your upcoming quarter schedule?"
        )

    return {
        'response': response,
        'proposedCourses': proposed_courses,
        'toolCalls': tool_calls_simulated,
        'model': 'mock-slug-advisor-v1',
    }
