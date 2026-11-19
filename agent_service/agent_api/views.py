import json

from django.http import HttpRequest, JsonResponse
import re
import requests
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt

from agent.agent import run_agent


@csrf_exempt
def process_agent_query(request: HttpRequest) -> JsonResponse:
    """
    POST /api/agent/process/
    Processes an incoming prompt with student context and conversation history.
    """
    if request.method != "POST":
        return JsonResponse(
            {"success": False, "error": "Method not allowed. Use POST."}, status=405
        )

    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"success": False, "error": "Malformed JSON body."}, status=400)

    prompt = data.get("prompt", "").strip()
    if not prompt:
        return JsonResponse({"success": False, "error": "Prompt cannot be empty."}, status=400)

    student = data.get("student", {})
    preferences = data.get("preferences", {})
    schedule = data.get("currentSchedule", [])
    history = data.get("history", [])

    use_mock = data.get("useMock")
    if use_mock is None:
        header_val = request.headers.get("X-Mock-Agent") or request.META.get("HTTP_X_MOCK_AGENT")
        if header_val:
            use_mock = str(header_val).lower() in ("true", "1", "t")

    session_token = data.get('sessionToken')
    if not session_token:
        auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION')
        if auth_header and auth_header.startswith('Bearer '):
            session_token = auth_header[7:].strip()

    try:
        result = run_agent(
            prompt=prompt,
            student=student,
            preferences=preferences,
            schedule=schedule,
            history=history,
            use_mock_override=use_mock,
            session_token=session_token,
        )
        if not isinstance(result, dict):
            result = {"response": str(result), "proposedCourses": [], "toolCalls": []}
        result.setdefault("proposedCourses", [])
        result.setdefault("toolCalls", [])
        return JsonResponse({"success": True, "data": result}, status=200)
    except Exception as e:
        return JsonResponse(
            {"success": False, "error": f"Agent execution error: {str(e)}"}, status=500
        )
        return JsonResponse({'success': False, 'error': f'Agent execution error: {str(e)}'}, status=500)


def _parse_days_to_byday(days_str: str) -> str:
    day_map = {
        'm': 'MO', 'mo': 'MO', 'mon': 'MO',
        'tu': 'TU', 't': 'TU', 'tue': 'TU',
        'w': 'WE', 'we': 'WE', 'wed': 'WE',
        'th': 'TH', 'r': 'TH', 'thu': 'TH',
        'f': 'FR', 'fr': 'FR', 'fri': 'FR',
        'sa': 'SA', 'sat': 'SA',
        'su': 'SU', 'u': 'SU', 'sun': 'SU'
    }
    tokens = [d.strip() for d in days_str.split(',') if d.strip()]
    if not tokens:
        tokens = re.findall(r'Th|Tu|Sa|Su|[MTWRFSU]', days_str, re.IGNORECASE)
    bydays = []
    for t in tokens:
        code = day_map.get(t.lower())
        if code and code not in bydays:
            bydays.append(code)
    return ",".join(bydays)


@csrf_exempt
def push_event_to_google(request: HttpRequest) -> JsonResponse:
    """
    POST /api/sync/push/
    Internal endpoint to push a schedule event to the student's Google Calendar.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed. Use POST.'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'success': False, 'error': 'Malformed JSON body.'}, status=400)

    google_token = data.get('googleToken')
    event = data.get('event')

    if not google_token or not event:
        return JsonResponse({'success': False, 'error': 'Missing googleToken or event payload.'}, status=400)

    course_code = event.get('courseCode', '').strip()
    title = event.get('title', '').strip()
    description = event.get('description', '').strip()
    days = event.get('days', '').strip()
    start_time = event.get('startTime', '').strip()
    end_time = event.get('endTime', '').strip()
    start_date = event.get('startDate', '').strip()
    end_date = event.get('endDate', '').strip()

    if course_code and title:
        summary = f"{course_code}: {title}"
    else:
        summary = title or course_code or "Scheduled Class"

    event_desc = f"{description}\nScheduled by Sammy the Slug" if description else "Scheduled by Sammy the Slug"

    # Normalize start/end time format HH:MM:SS
    if len(start_time) == 5:
        start_time_iso = f"{start_time}:00"
    else:
        start_time_iso = start_time

    if len(end_time) == 5:
        end_time_iso = f"{end_time}:00"
    else:
        end_time_iso = end_time

    start_datetime = f"{start_date}T{start_time_iso}"
    end_datetime = f"{start_date}T{end_time_iso}"

    recurrence = []
    byday_str = _parse_days_to_byday(days) if days else ""
    if byday_str:
        until_str = end_date.replace('-', '') + "T235959Z" if end_date else ""
        if until_str:
            recurrence.append(f"RRULE:FREQ=WEEKLY;BYDAY={byday_str};UNTIL={until_str}")
        else:
            recurrence.append(f"RRULE:FREQ=WEEKLY;BYDAY={byday_str}")

    google_payload = {
        "summary": summary,
        "description": event_desc,
        "start": {
            "dateTime": start_datetime,
            "timeZone": "America/Los_Angeles",
        },
        "end": {
            "dateTime": end_datetime,
            "timeZone": "America/Los_Angeles",
        },
    }
    if recurrence:
        google_payload["recurrence"] = recurrence

    try:
        headers = {
            "Authorization": f"Bearer {google_token}",
            "Content-Type": "application/json",
        }
        resp = requests.post(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            json=google_payload,
            headers=headers,
            timeout=10,
        )

        if resp.status_code in (200, 201):
            resp_json = resp.json()
            return JsonResponse({
                'success': True,
                'data': {
                    'googleEventId': resp_json.get('id')
                }
            }, status=200)

        if resp.status_code == 401:
            return JsonResponse({
                'success': False,
                'error': 'GOOGLE_TOKEN_EXPIRED',
                'message': 'The provided Google OAuth access token is expired or unauthorized.'
            }, status=401)

        return JsonResponse({
            'success': False,
            'error': f'Google Calendar API error: {resp.text}'
        }, status=resp.status_code)

    except Exception as e:
        return JsonResponse({'success': False, 'error': f'Failed to push to Google Calendar: {str(e)}'}, status=500)

