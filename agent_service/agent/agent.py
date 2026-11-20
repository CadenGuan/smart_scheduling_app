import json
import os
import re
from typing import Any, Dict, List, Optional

from agent_api.prompt_builder import build_system_prompt, format_history_messages

from .mock_agent import run_mock_agent
from .tools import (
    get_course_catalog,
    get_inspection_tools,
    is_course_requested_or_pinned,
    set_tool_context,
)


def run_agent(
    prompt: str,
    student: Dict[str, Any],
    preferences: Dict[str, Any],
    schedule: List[Dict[str, Any]],
    history: List[Dict[str, Any]],
    use_mock_override: Any = None,
    session_token: Optional[str] = None,
    node_api_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main entrypoint for the LangChain agent.
    If GEMINI_API_KEY is configured, invokes Google Gemini with read-only inspection tools.
    Otherwise, gracefully delegates to the internal mock agent for offline execution.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    use_mock = (
        use_mock_override
        if use_mock_override is not None
        else (
            os.environ.get("USE_MOCK_AGENT", "false").lower() in ("true", "1", "t")
            or os.environ.get("AGENT_MODE", "").lower() == "mock"
            or "PYTEST_CURRENT_TEST" in os.environ
        )
    )

    # If mock explicitly enabled (e.g. during automated test execution), use deterministic mock agent
    if use_mock:
        return run_mock_agent(prompt, student, preferences, schedule, history)

    # In live mode, do NOT fall back to mock agent if API key is missing
    if not api_key:
        return {
            "response": "⚠️ **Live Agent Configuration Error**: `GEMINI_API_KEY` is missing or empty. Please set `GEMINI_API_KEY` in `agent_service/.env` to run the live agent.",
            "proposedCourses": [],
            "toolCalls": [],
            "error": "MISSING_GEMINI_API_KEY",
            "model": "live-agent-error",
        }

    try:
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
        from langchain_google_genai import ChatGoogleGenerativeAI

        set_tool_context(
            student,
            preferences,
            schedule,
            session_token=session_token,
            node_api_url=node_api_url,
        )
        tools = get_inspection_tools()

        model_name = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.4,
        )
        llm_with_tools = llm.bind_tools(tools)

        system_prompt = build_system_prompt(student, preferences, schedule)
        messages: List[Any] = [SystemMessage(content=system_prompt)]

        # Add historical conversation turns
        for item in format_history_messages(history):
            if item["role"] == "user":
                messages.append(HumanMessage(content=item["content"]))
            else:
                messages.append(AIMessage(content=item["content"]))

        # Add current user prompt
        messages.append(HumanMessage(content=prompt))

        from langchain_core.messages import ToolMessage

        current_messages: List[Any] = list(messages)
        tool_calls_executed = []
        max_tool_hops = 5
        hop = 0
        ai_msg = None

        while hop < max_tool_hops:
            ai_msg = llm_with_tools.invoke(current_messages)
            current_messages.append(ai_msg)

            tool_calls = getattr(ai_msg, "tool_calls", None)
            if not tool_calls:
                # LLM finished its tool execution and returned conversational response
                break

            hop += 1
            for tc in tool_calls:
                tool_name = tc.get("name")
                tool_args = tc.get("args", {})
                matching_tool = next((t for t in tools if t.name == tool_name), None)
                if matching_tool:
                    try:
                        tool_output = matching_tool.invoke(tool_args)
                    except Exception as err:
                        tool_output = f"Tool execution error: {err}"
                else:
                    tool_output = f"Error: Tool '{tool_name}' not found."

                tool_calls_executed.append(
                    {
                        "tool": tool_name,
                        "args": tool_args,
                        "output": tool_output,
                    }
                )
                current_messages.append(
                    ToolMessage(
                        content=str(tool_output),
                        tool_call_id=tc.get("id") or f"call-{hop}-{tool_name}",
                    )
                )

        content_text = ai_msg.content if ai_msg else ""
        if isinstance(content_text, list):
            text_parts = [
                (p.get("text", "") if isinstance(p, dict) else str(p)) for p in content_text
            ]
            content_text = "\n".join(text_parts).strip()
        elif content_text is None:
            content_text = ""
        else:
            content_text = str(content_text).strip()

        # If model exhausted all tool hops without generating conversational prose, invoke one last conversational completion
        if not content_text:
            current_messages.append(
                HumanMessage(
                    content="Please provide your final direct, conversational answer to the student based on the information retrieved above."
                )
            )
            final_turn = llm.invoke(current_messages)
            final_content = getattr(final_turn, "content", "")
            if isinstance(final_content, list):
                content_text = "\n".join(
                    [(p.get("text", "") if isinstance(p, dict) else str(p)) for p in final_content]
                ).strip()
            elif final_content is not None:
                content_text = str(final_content).strip()

        if isinstance(content_text, list):
            text_parts = [
                (p.get("text", "") if isinstance(p, dict) else str(p)) for p in content_text
            ]
            content_text = "\n".join(text_parts)

        # Extract proposed courses matching CalendarEvent schema
        proposed_courses: List[Dict[str, Any]] = []
        course_ids_seen = set()

        # 1. Collect from executed search_course_catalog tool calls
        for tool_exec in tool_calls_executed:
            if tool_exec.get("tool") == "search_course_catalog":
                output_val = tool_exec.get("output")
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
                        if isinstance(c, dict) and "id" in c and c["id"] not in course_ids_seen:
                            course_ids_seen.add(c["id"])
                            proposed_courses.append(dict(c))

        # 2. Collect any courses mentioned by code or id in agent output or user prompt
        catalog = get_course_catalog()
        combined_text = (str(content_text) + " " + prompt).lower()
        for cat_course in catalog:
            code_lower = (cat_course.get("code") or "").lower()
            id_lower = (cat_course.get("id") or "").lower()
            if cat_course["id"] not in course_ids_seen:
                if (
                    code_lower and re.search(r"\b" + re.escape(code_lower) + r"\b", combined_text)
                ) or (id_lower and id_lower in combined_text):
                    course_ids_seen.add(cat_course["id"])
                    proposed_courses.append(dict(cat_course))

        # 3. Detect and set pinned status based on explicit user requests
        for candidate in proposed_courses:
            candidate["pinned"] = is_course_requested_or_pinned(prompt, candidate)

        # Prioritize pinned courses and directly recommended courses
        def get_priority(c: Dict[str, Any]) -> int:
            if c.get("pinned"):
                return 0
            code_l = (c.get("code") or "").lower()
            if code_l and re.search(r"\b" + re.escape(code_l) + r"\b", str(content_text).lower()):
                return 1
            return 2

        proposed_courses.sort(key=get_priority)

        return {
            "response": str(content_text),
            "proposedCourses": proposed_courses,
            "toolCalls": tool_calls_executed,
            "model": model_name,
        }

    except Exception as e:
        error_msg = str(e)
        return {
            "response": f"⚠️ **Live Agent Execution Error**: {error_msg}\n\n*(Mock agent fallback is disabled in live mode)*",
            "proposedCourses": [],
            "toolCalls": tool_calls_executed if "tool_calls_executed" in locals() else [],
            "error": error_msg,
            "metadata": {"fallbackReason": error_msg, "error": error_msg},
            "model": model_name if "model_name" in locals() else "gemini-error",
        }
