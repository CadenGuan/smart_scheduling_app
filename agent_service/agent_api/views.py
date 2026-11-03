import json
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from agent.agent import run_agent

@csrf_exempt
def process_agent_query(request: HttpRequest) -> JsonResponse:
    """
    POST /api/agent/process/
    Processes an incoming prompt with student context and conversation history.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed. Use POST.'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'success': False, 'error': 'Malformed JSON body.'}, status=400)

    prompt = data.get('prompt', '').strip()
    if not prompt:
        return JsonResponse({'success': False, 'error': 'Prompt cannot be empty.'}, status=400)

    student = data.get('student', {})
    preferences = data.get('preferences', {})
    schedule = data.get('currentSchedule', [])
    history = data.get('history', [])

    try:
        result = run_agent(
            prompt=prompt,
            student=student,
            preferences=preferences,
            schedule=schedule,
            history=history
        )
        if not isinstance(result, dict):
            result = {'response': str(result), 'proposedCourses': [], 'toolCalls': []}
        result.setdefault('proposedCourses', [])
        result.setdefault('toolCalls', [])
        return JsonResponse({'success': True, 'data': result}, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': f'Agent execution error: {str(e)}'}, status=500)
