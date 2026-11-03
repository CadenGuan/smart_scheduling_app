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
    """
    prompt_lower = prompt.lower()
    name = student.get('name', 'Slug')
    major = student.get('major', 'Computer Science B.S.')
    standing = student.get('standing', 'Junior')

    ge_status = preferences.get('geStatus', {})
    remaining_ges = ge_status.get('remaining', []) if isinstance(ge_status, dict) else []
    target_credits = preferences.get('targetCredits', 15)

    tool_calls_simulated = []

    # Scenario A: Inquiring about GE requirements
    if 'ge' in prompt_lower or 'general ed' in prompt_lower or 'requirement' in prompt_lower:
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

    # Scenario B: Course recommendations or prerequisite checking
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

    # Scenario C: Calendar, schedule, conflicts, or breaks
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
