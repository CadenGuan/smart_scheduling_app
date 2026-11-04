
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
    history: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Main entrypoint for the LangChain agent.

    Uses student information, scheduling preferences, and conversation
    history to generate course recommendations.

    The agent uses Gemini with read-only inspection tools when an API key
    is available. Otherwise, it falls back to the mock agent.

    Returns the agent response, proposed courses, tool execution results,
    and model information.
    """

    # Load the Gemini API key from environment variables.
    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')

    # Use the mock agent if no API key is configured.
    # This allows local development and testing without Gemini access.
    if not api_key:
        return run_mock_agent(prompt, student, preferences, schedule, history)

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        # Set the context used by the inspection tools.
        # Tools can access the student's information and current schedule.
        set_tool_context(student, preferences, schedule)
        tools = get_inspection_tools()

        # Initialize Gemini with a relatively low temperature
        # to encourage more consistent responses.
        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=api_key,
            temperature=0.4,
        )

        # Bind the available tools so Gemini can request their execution.
        llm_with_tools = llm.bind_tools(tools)

        # Build the system prompt using the student's profile,
        # preferences, and current schedule.
        system_prompt = build_system_prompt(student, preferences, schedule)
        messages = [SystemMessage(content=system_prompt)]

        # Restore previous conversation turns to provide context.
        # Convert stored messages into LangChain message objects.
        for item in format_history_messages(history):
            if item['role'] == 'user':
                messages.append(HumanMessage(content=item['content']))
            else:
                messages.append(AIMessage(content=item['content']))

        # Append the latest user message to the conversation.
        messages.append(HumanMessage(content=prompt))

        # Send the conversation to Gemini for an initial response.
        ai_msg = llm_with_tools.invoke(messages)

        # Record executed tool calls for debugging and course extraction.
        tool_calls_executed = []

        # Execute any inspection tools requested by Gemini.
        if hasattr(ai_msg, 'tool_calls') and ai_msg.tool_calls:
            for tc in ai_msg.tool_calls:
                tool_name = tc.get('name')
                tool_args = tc.get('args', {})

                # Find the requested tool by name.
                matching_tool = next((t for t in tools if t.name == tool_name), None)

                if matching_tool:
                    # Execute the tool and store its arguments and result.
                    tool_output = matching_tool.invoke(tool_args)
                    tool_calls_executed.append({
                        'tool': tool_name,
                        'args': tool_args,
                        'output': tool_output,
                    })

            # Create a second conversation containing the tool results.
            # Gemini uses these results to generate its final answer.
            second_messages = list(messages)
            second_messages.append(ai_msg)

            for tc, executed in zip(ai_msg.tool_calls, tool_calls_executed):
                from langchain_core.messages import ToolMessage
                second_messages.append(
                    ToolMessage(content=str(executed['output']), tool_call_id=tc.get('id', 'tool-call-1'))
                )

            # Request the final response after tool execution.
            final_response = llm.invoke(second_messages)
            content_text = final_response.content
        else:
            # No tools were requested, so use the initial response.
            content_text = ai_msg.content

        # Extract proposed courses for the scheduling system.
        # Keep track of course IDs to avoid duplicate entries.
        proposed_courses: List[Dict[str, Any]] = []
        course_ids_seen = set()

        # Step 1: Collect courses returned by the catalog search tool.
        for tc in tool_calls_executed:
            if tc.get('tool') == 'search_course_catalog':
                output_val = tc.get('output')

                # Parse JSON strings into Python objects when necessary.
                if isinstance(output_val, str):
                    try:
                        parsed = json.loads(output_val)
                    except Exception:
                        parsed = []
                elif isinstance(output_val, list):
                    parsed = output_val
                else:
                    parsed = []

                # Add courses with valid IDs, skipping duplicates.
                if isinstance(parsed, list):
                    for c in parsed:
                        if isinstance(c, dict) and 'id' in c and c['id'] not in course_ids_seen:
                            course_ids_seen.add(c['id'])
                            proposed_courses.append(dict(c))

        # Step 2: Find additional courses mentioned in the agent's
        # response or the user's prompt using catalog codes and IDs.
        catalog = get_course_catalog()
        combined_text = (str(content_text) + " " + prompt).lower()

        for cat_course in catalog:
            code_lower = (cat_course.get('code') or '').lower()
            id_lower = (cat_course.get('id') or '').lower()

            if cat_course['id'] not in course_ids_seen:
                # Match course codes using word boundaries to reduce
                # accidental partial matches.
                if (code_lower and re.search(r'\b' + re.escape(code_lower) + r'\b', combined_text)) or \
                   (id_lower and id_lower in combined_text):
                    course_ids_seen.add(cat_course['id'])
                    proposed_courses.append(dict(cat_course))

        # Step 3: Mark courses explicitly requested by the user.
        # Pinned courses receive the highest recommendation priority.
        for candidate in proposed_courses:
            candidate['pinned'] = is_course_requested_or_pinned(prompt, candidate)

        # Assign a priority to each proposed course:
        # 0 = Explicitly requested or pinned by the user.
        # 1 = Mentioned directly in the agent's response.
        # 2 = Other courses collected from tool results.
        def get_priority(c: Dict[str, Any]) -> int:
            if c.get('pinned'):
                return 0

            code_l = (c.get('code') or '').lower()
            if code_l and re.search(r'\b' + re.escape(code_l) + r'\b', str(content_text).lower()):
                return 1

            return 2

        # Sort proposed courses by priority before returning them.
        proposed_courses.sort(key=get_priority)

        # Return the response and structured course recommendations.
        # Other components can use proposedCourses to build a schedule.
        return {
            'response': str(content_text),
            'proposedCourses': proposed_courses,
            'toolCalls': tool_calls_executed,
            'model': 'gemini-1.5-flash',
        }

    except Exception as e:
        # Fall back to the mock agent if Gemini or tool execution fails.
        # Store the error message to help diagnose the failure.
        mock_result = run_mock_agent(prompt, student, preferences, schedule, history)

        # Ensure the fallback response contains the expected field.
        if 'proposedCourses' not in mock_result:
            mock_result['proposedCourses'] = []

        mock_result['metadata'] = {'fallbackReason': str(e)}
        return mock_result
