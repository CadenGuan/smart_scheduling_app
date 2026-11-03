from typing import Dict, Any, List

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
    Supports multi-turn memory recall and recommendation rationale explanations.
    """
    prompt_lower = prompt.lower()
    name = student.get('name', 'Slug')
    major = student.get('major', 'Computer Science B.S.')
    standing = student.get('standing', 'Junior')

    ge_status = preferences.get('geStatus', {})
    remaining_ges = ge_status.get('remaining', []) if isinstance(ge_status, dict) else []
    target_credits = preferences.get('targetCredits', 15)

    tool_calls_simulated = []

    # Scenario 1: Explaining Rationale / "Why" (Sprint 2 Priority 3 User Story)
    if 'why' in prompt_lower or 'reason' in prompt_lower or 'explain' in prompt_lower or 'rationale' in prompt_lower:
        tool_calls_simulated.append({
            'tool': 'explain_course_rationale',
            'output': {
                'standing': standing,
                'major': major,
                'targetCredits': target_credits,
            }
        })

        # Determine course hint from prompt or conversation history
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

        response = (
            f"Here is why Sammy recommends **`{course_hint}`** for your plan: 💡\n\n"
            f"1. **Prerequisite Unblocking:** As a **{standing}** in `{major}`, `{course_hint}` is crucial for your degree velocity. Delaying it can bottleneck your upper-division electives.\n"
            f"2. **Workload Balancing:** Pacing this alongside your general education or secondary coursework keeps your schedule within your target **{target_credits} credits** while avoiding excessive coding project overload.\n"
            f"3. **Schedule Feasibility:** The scheduled section slots cleanly into your week without overlapping your external commitments or violating your preferred break windows."
        )

    # Scenario 2: Multi-turn Follow-up / Recall (Sprint 2 Priority 8 User Story)
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

    # Scenario 3: Returning User Greeting (Sprint 2 Priority 5 User Story)
    elif ('hello' in prompt_lower or 'hi' in prompt_lower or 'hey' in prompt_lower) and len(history) > 0:
        response = (
            f"Welcome back, {name}! 🐌 Great to see you again.\n\n"
            f"I still have your record on file (**{standing}** in `{major}` aiming for **{target_credits} credits**). "
            f"What would you like to check or adjust in your schedule today?"
        )

    # Scenario 4: Inquiring about GE requirements
    elif 'ge' in prompt_lower or 'general ed' in prompt_lower or 'requirement' in prompt_lower:
        tool_calls_simulated.append({
            'tool': 'query_degree_ge_requirements',
            'output': {'remaining': remaining_ges}
        })
        if remaining_ges:
            ge_list = ", ".join([f"`{g}`" for g in remaining_ges])
            response = (
                f"Hey {name}! 🐌 Based on your degree progress, you currently have the following **General Education (GE)** requirements remaining: {ge_list}.\n\n"
                f"### Recommended UCSC GE Courses for Next Quarter:\n"
                f"- **`PHIL 9` (Introduction to Logic)** – Satisfies the `MF` or `ER` requirement while reinforcing formal proof thinking for upper-division CS.\n"
                f"- **`ART 10F` (2D Design)** – Satisfies `PR` with a creative, studio-based workflow to balance heavy coding labs.\n"
                f"- **`THEA 20` (Intro to Acting)** – Satisfies `IM` or `TA` with an interactive, collaborative format.\n\n"
                f"Pairing one of these with your required major courses will keep you on pace for your **{target_credits}-credit** target without overloading your finals week!"
            )
        else:
            response = (
                f"Great news, {name}! 🎉 Your records show you have already completed or transferred all primary General Education requirements. "
                f"You can focus your elective space entirely on upper-division `{major}` electives or exploratory minor coursework."
            )

    # Scenario 5: Course recommendations or prerequisite checking
    elif 'cse' in prompt_lower or 'course' in prompt_lower or 'class' in prompt_lower or 'recommend' in prompt_lower or 'major' in prompt_lower:
        tool_calls_simulated.append({
            'tool': 'inspect_student_profile',
            'output': {'standing': standing, 'major': major}
        })
        response = (
            f"Here is Sammy's recommended plan for a **{standing}** in `{major}`: 📚\n\n"
            f"### High-Priority Core Courses:\n"
            f"1. **`CSE 101` (Algorithms & Abstract Data Types)** – Critical prerequisite gatekeeper for virtually all upper-division electives.\n"
            f"2. **`CSE 115A` (Intro to Software Engineering)** – Hands-on team project course; excellent preparation for industry internships.\n"
            f"3. **`CSE 130` (Principles of Computer Systems Design)** – Rigorous systems programming covering concurrency, virtual memory, and distributed primitives.\n\n"
            f"💡 **Pro-Tip**: Avoid taking `CSE 101` and `CSE 130` in the exact same quarter unless you have a lighter third course, as both require heavy weekly programming assignments."
        )

    # Scenario 6: Calendar, schedule, conflicts, or breaks
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
            f"- Plan your prerequisite pathways for `{major}`\n"
            f"- Inspect schedule feasibility against your **{target_credits}-credit** goal and Google Calendar commitments\n\n"
            f"What would you like to explore for your upcoming quarter schedule?"
        )

    return {
        'response': response,
        'toolCalls': tool_calls_simulated,
        'model': 'mock-slug-advisor-v1',
    }
