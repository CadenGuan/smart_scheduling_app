import os
import re
import json
from typing import Dict, Any, List
from .tools import set_tool_context, get_inspection_tools, get_course_catalog, is_course_requested_or_pinned
from .mock_agent import run_mock_agent
from agent_api.prompt_builder import build_system_prompt, format_history_messages

def run_agent(
    prompt: str,
    student: Dict[str, Any],
    preferences: Dict[str, Any],
    schedule: List[Dict[str, Any]],
    history: List[Dict[str, Any]],
    use_mock_override: Any = None
) -> Dict[str, Any]:
    """
    Main entrypoint for the LangChain agent.
    If GEMINI_API_KEY is configured, invokes Google Gemini with read-only inspection tools.
    Otherwise, gracefully delegates to the internal mock agent for offline execution.
    """
    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    use_mock = use_mock_override if use_mock_override is not None else (
        os.environ.get('USE_MOCK_AGENT', 'false').lower() in ('true', '1', 't')
    )

    # If mock explicitly enabled (e.g. during automated test execution), use deterministic mock agent
    if use_mock:
        return run_mock_agent(prompt, student, preferences, schedule, history)

    # If no API key configured, gracefully delegate to internal mock agent
    if not api_key:
        return run_mock_agent(prompt, student, preferences, schedule, history)

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        set_tool_context(student, preferences, schedule)
        tools = get_inspection_tools()

        model_name = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.4,
        )
        llm_with_tools = llm.bind_tools(tools)

        system_prompt = build_system_prompt(student, preferences, schedule)
        messages = [SystemMessage(content=system_prompt)]

        # Add historical conversation turns
        for item in format_history_messages(history):
            if item['role'] == 'user':
                messages.append(HumanMessage(content=item['content']))
            else:
                messages.append(AIMessage(content=item['content']))

        # Add current user prompt
        messages.append(HumanMessage(content=prompt))

        ai_msg = llm_with_tools.invoke(messages)

        tool_calls_executed = []
        # If the LLM requested tool calls, execute them
        if hasattr(ai_msg, 'tool_calls') and ai_msg.tool_calls:
            for tc in ai_msg.tool_calls:
                tool_name = tc.get('name')
                tool_args = tc.get('args', {})
                matching_tool = next((t for t in tools if t.name == tool_name), None)
                if matching_tool:
                    tool_output = matching_tool.invoke(tool_args)
                    tool_calls_executed.append({
                        'tool': tool_name,
                        'args': tool_args,
                        'output': tool_output,
                    })

            # If tool calls were made, ask model to generate final answer incorporating tool outputs
            second_messages = list(messages)
            second_messages.append(ai_msg)
            for tc, executed in zip(ai_msg.tool_calls, tool_calls_executed):
                from langchain_core.messages import ToolMessage
                second_messages.append(
                    ToolMessage(content=str(executed['output']), tool_call_id=tc.get('id', 'tool-call-1'))
                )
            final_response = llm.invoke(second_messages)
            content_text = final_response.content
        else:
            content_text = ai_msg.content

        # Extract proposed courses matching CalendarEvent schema
        proposed_courses: List[Dict[str, Any]] = []
        course_ids_seen = set()

        # 1. Collect from executed search_course_catalog tool calls
        for tc in tool_calls_executed:
            if tc.get('tool') == 'search_course_catalog':
                output_val = tc.get('output')
                if isinstance(output_val, str):
                    try:
                        parsed = json.loads(output_val)
                    except Exception:
                        parsed = []
                elif isinstance(output_val, list):
                    parsed = output_val
                else:
                    parsed = []

                if isinstance(parsed, list):
                    for c in parsed:
                        if isinstance(c, dict) and 'id' in c and c['id'] not in course_ids_seen:
                            course_ids_seen.add(c['id'])
                            proposed_courses.append(dict(c))

        # 2. Collect any courses mentioned by code or id in agent output or user prompt
        catalog = get_course_catalog()
        combined_text = (str(content_text) + " " + prompt).lower()
        for cat_course in catalog:
            code_lower = (cat_course.get('code') or '').lower()
            id_lower = (cat_course.get('id') or '').lower()
            if cat_course['id'] not in course_ids_seen:
                if (code_lower and re.search(r'\b' + re.escape(code_lower) + r'\b', combined_text)) or \
                   (id_lower and id_lower in combined_text):
                    course_ids_seen.add(cat_course['id'])
                    proposed_courses.append(dict(cat_course))

        # 3. Detect and set pinned status based on explicit user requests
        for candidate in proposed_courses:
            candidate['pinned'] = is_course_requested_or_pinned(prompt, candidate)

        # Prioritize pinned courses and directly recommended courses
        def get_priority(c: Dict[str, Any]) -> int:
            if c.get('pinned'):
                return 0
            code_l = (c.get('code') or '').lower()
            if code_l and re.search(r'\b' + re.escape(code_l) + r'\b', str(content_text).lower()):
                return 1
            return 2

        proposed_courses.sort(key=get_priority)

        return {
            'response': str(content_text),
            'proposedCourses': proposed_courses,
            'toolCalls': tool_calls_executed,
            'model': model_name,
        }

    except Exception as e:
        # Fallback to mock agent on API error or connection failure
        mock_result = run_mock_agent(prompt, student, preferences, schedule, history)
        if 'proposedCourses' not in mock_result:
            mock_result['proposedCourses'] = []
        mock_result['metadata'] = {'fallbackReason': str(e)}
        return mock_result
