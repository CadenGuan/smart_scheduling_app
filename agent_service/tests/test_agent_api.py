import json
from django.test import TestCase, Client
from agent_api.prompt_builder import build_system_prompt, format_history_messages
from agent.tools import (
    set_tool_context,
    inspect_student_profile,
    query_degree_ge_requirements,
    inspect_calendar_schedule,
    explain_course_rationale,
)

class AgentApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_get_method_returns_405(self):
        response = self.client.get('/api/agent/process/')
        self.assertEqual(response.status_code, 405)
        data = response.json()
        self.assertFalse(data['success'])

    def test_empty_prompt_returns_400(self):
        response = self.client.post(
            '/api/agent/process/',
            data=json.dumps({'prompt': '   '}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['success'])
        self.assertIn('Prompt cannot be empty', data['error'])

    def test_malformed_json_returns_400(self):
        response = self.client.post(
            '/api/agent/process/',
            data="not-valid-json",
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['success'])

    def test_valid_prompt_returns_slug_recommendation(self):
        payload = {
            'prompt': 'What GE requirements do I have left?',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {
                'geStatus': {'remaining': ['CC', 'ER'], 'source': 'UCSC'},
                'targetCredits': 15,
                'majorRequirementsTaken': ['CSE 12', 'CSE 13S']
            },
            'currentSchedule': [
                {
                    'id': 'cse-115a',
                    'title': 'CSE 115A: Intro to Software Engineering',
                    'days': ['Monday', 'Wednesday', 'Friday'],
                    'startTime': '09:00',
                    'endTime': '10:10',
                    'type': 'MAJOR'
                }
            ],
            'history': []
        }
        response = self.client.post(
            '/api/agent/process/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertIn('response', data['data'])
        self.assertIn('CC', data['data']['response'])
        self.assertIn('ER', data['data']['response'])

    def test_prompt_builder_contains_all_constraints(self):
        student = {'name': 'Sammy Slug', 'major': 'Computer Science B.S.', 'standing': 'Junior'}
        preferences = {
            'targetCredits': 19,
            'geStatus': {'remaining': ['TA', 'PE']},
            'majorRequirementsTaken': ['CSE 101'],
            'breaksPreference': [{'label': 'Lunch', 'startTime': '12:00', 'endTime': '13:00'}],
            'preferredFreeDays': ['Friday'],
            'earliestStartTime': '09:00',
            'latestEndTime': '17:00',
            'maxBackToBackHours': 3,
        }
        schedule = [{'title': 'CSE 115A', 'days': ['Monday'], 'startTime': '09:00', 'endTime': '10:10'}]

        prompt = build_system_prompt(student, preferences, schedule)
        self.assertIn('Sammy Slug', prompt)
        self.assertIn('Computer Science B.S.', prompt)
        self.assertIn('19', prompt)
        self.assertIn('TA, PE', prompt)
        self.assertIn('CSE 101', prompt)
        self.assertIn('CSE 115A', prompt)
        self.assertIn('Friday', prompt)
        self.assertIn('09:00', prompt)

    def test_inspection_tools(self):
        student = {'name': 'Sammy Slug', 'major': 'CS B.S.', 'standing': 'Senior'}
        preferences = {'geStatus': {'remaining': ['IM']}, 'targetCredits': 15}
        schedule = [{'id': 'math-21', 'title': 'MATH 21'}]

        set_tool_context(student, preferences, schedule)

        profile_json = json.loads(inspect_student_profile.invoke({}))
        self.assertEqual(profile_json['standing'], 'Senior')

        ge_json = json.loads(query_degree_ge_requirements.invoke({}))
        self.assertEqual(ge_json['remainingGEs'], ['IM'])

        sched_json = json.loads(inspect_calendar_schedule.invoke({}))
        self.assertEqual(sched_json['totalCount'], 1)

        rationale_json = json.loads(explain_course_rationale.invoke({'course_code': 'CSE 101'}))
        self.assertEqual(rationale_json['course'], 'CSE 101')
        self.assertIn('CS B.S.', rationale_json['targetMajor'])

    def test_why_prompt_returns_rationale_explanation(self):
        payload = {
            'prompt': 'Why do you recommend CSE 101?',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': []
        }
        response = self.client.post(
            '/api/agent/process/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        response_text = data['data']['response']
        self.assertIn('CSE 101', response_text)
        self.assertIn('Prerequisite Unblocking', response_text)
        self.assertIn('Workload Balancing', response_text)

        # Confirm tool call executed
        tool_names = [tc['tool'] for tc in data['data']['toolCalls']]
        self.assertIn('explain_course_rationale', tool_names)

    def test_multiturn_recall_and_returning_user_greeting(self):
        # 1. Returning user greeting
        payload_greet = {
            'prompt': 'Hello!',
            'student': {'name': 'Sammy Slug', 'major': 'Computer Science B.S.', 'standing': 'Junior'},
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': [
                {'sender': 'USER', 'content': 'Hi'},
                {'sender': 'AGENT', 'content': 'Hello Sammy!'}
            ]
        }
        res_greet = self.client.post('/api/agent/process/', data=json.dumps(payload_greet), content_type='application/json')
        self.assertEqual(res_greet.status_code, 200)
        self.assertIn('Welcome back, Sammy Slug', res_greet.json()['data']['response'])

        # 2. Multi-turn follow-up
        payload_followup = {
            'prompt': 'Can you tell me more about that?',
            'student': {'name': 'Sammy Slug', 'major': 'Computer Science B.S.', 'standing': 'Junior'},
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': [
                {'sender': 'USER', 'content': 'What GE requirements should I take?'},
                {'sender': 'AGENT', 'content': 'I recommend taking a GE like PHIL 9 or ART 10F.'}
            ]
        }
        res_followup = self.client.post('/api/agent/process/', data=json.dumps(payload_followup), content_type='application/json')
        self.assertEqual(res_followup.status_code, 200)
        self.assertIn('Continuing from what we discussed', res_followup.json()['data']['response'])
        self.assertIn('General Education', res_followup.json()['data']['response'])
