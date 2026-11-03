import os
from typing import Dict, Any, List
from .tools import set_tool_context, get_inspection_tools
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
    If GEMINI_API_KEY is configured, invokes Google Gemini with read-only inspection tools.
    Otherwise, gracefully delegates to the internal mock agent for offline execution.
    """
    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')

    # If no API key configured, use deterministic mock agent
    if not api_key:
        return run_mock_agent(prompt, student, preferences, schedule, history)

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        set_tool_context(student, preferences, schedule)
        tools = get_inspection_tools()

        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
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

        return {
            'response': str(content_text),
            'toolCalls': tool_calls_executed,
            'model': 'gemini-1.5-flash',
        }

    except Exception as e:
        # Fallback to mock agent on API error or connection failure
        mock_result = run_mock_agent(prompt, student, preferences, schedule, history)
        mock_result['metadata'] = {'fallbackReason': str(e)}
        return mock_result
