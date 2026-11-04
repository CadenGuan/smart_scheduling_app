import json
import re
from django.test import TestCase, Client
from agent_api.prompt_builder import build_system_prompt, format_history_messages
from agent.tools import (
    set_tool_context,
    inspect_student_profile,
    query_degree_ge_requirements,
    inspect_calendar_schedule,
    explain_course_rationale,
    find_prerequisite_path,
    assess_drop_impact,
    update_schedule_preferences,
    search_course_catalog,
    get_inspection_tools,
    find_courses,
)
from agent.dag_solver import get_prerequisite_chain, get_downstream_impact, audit_degree_progress

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

    def test_inspection_and_dag_tools(self):
        student = {'name': 'Sammy Slug', 'major': 'CS B.S.', 'standing': 'Senior'}
        preferences = {'geStatus': {'remaining': ['IM']}, 'targetCredits': 15, 'majorRequirementsTaken': ['CSE 13S', 'CSE 16']}
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

        prereq_json = json.loads(find_prerequisite_path.invoke({'target_course': 'CSE 101'}))
        self.assertEqual(prereq_json['target'], 'CSE 101')

        drop_json = json.loads(assess_drop_impact.invoke({'course_code': 'CSE 101'}))
        self.assertEqual(drop_json['course'], 'CSE 101')
        self.assertTrue(drop_json['isGatekeeper'])
        self.assertGreaterEqual(drop_json['totalBlockedCount'], 7)

        pref_json = json.loads(update_schedule_preferences.invoke({'target_credits': 12}))
        self.assertEqual(pref_json['updates']['targetCredits'], 12)

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

    def test_prerequisite_path_query(self):
        payload = {
            'prompt': 'What is the prerequisite path to take CSE 130?',
            'student': {'name': 'Sammy Slug', 'major': 'Computer Science B.S.', 'standing': 'Junior'},
            'preferences': {'targetCredits': 15, 'majorRequirementsTaken': ['CSE 20', 'CSE 30']},
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('CSE 130', data['data']['response'])
        self.assertIn('Prerequisite Path', data['data']['response'])
        tool_names = [tc['tool'] for tc in data['data']['toolCalls']]
        self.assertIn('find_prerequisite_path', tool_names)

    def test_drop_course_impact_query(self):
        payload = {
            'prompt': 'What happens if I drop CSE 101?',
            'student': {'name': 'Sammy Slug', 'major': 'Computer Science B.S.', 'standing': 'Junior'},
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('downstream degree audit', data['data']['response'])
        self.assertIn('Critical Gatekeeper Warning', data['data']['response'])
        tool_names = [tc['tool'] for tc in data['data']['toolCalls']]
        self.assertIn('assess_drop_impact', tool_names)

    def test_workload_burnout_query_triggers_preference_update(self):
        payload = {
            'prompt': 'This schedule is too much for me, can you lighten my load?',
            'student': {'name': 'Sammy Slug', 'major': 'Computer Science B.S.', 'standing': 'Junior'},
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('adjusted your target credit preference', data['data']['response'])
        tool_names = [tc['tool'] for tc in data['data']['toolCalls']]
        self.assertIn('update_schedule_preferences', tool_names)
        self.assertEqual(data['data']['toolCalls'][0]['output']['updates']['targetCredits'], 12)

    def test_conversational_credit_change_triggers_preference_update(self):
        payload = {
            'prompt': 'Please change my target credits to 12',
            'student': {'name': 'Sammy Slug', 'major': 'Computer Science B.S.', 'standing': 'Junior'},
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('updated your scheduling preferences to target **12 credits**', data['data']['response'])
        tool_names = [tc['tool'] for tc in data['data']['toolCalls']]
        self.assertIn('update_schedule_preferences', tool_names)
        self.assertEqual(data['data']['toolCalls'][0]['output']['updates']['targetCredits'], 12)

    def test_export_calendar_query(self):
        payload = {
            'prompt': 'How do I export my schedule to Google Calendar?',
            'student': {'name': 'Sammy Slug', 'major': 'Computer Science B.S.', 'standing': 'Junior'},
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('Export .ics', data['data']['response'])
        self.assertIn('RFC 5545', data['data']['response'])

    def test_conference_deadlines_query(self):
        payload = {
            'prompt': 'What research conference deadlines should I look out for?',
            'student': {'name': 'Sammy Slug', 'major': 'Computer Science B.S.', 'standing': 'Junior'},
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('conference and undergraduate research deadlines', data['data']['response'])
        self.assertIn('UCSC Undergraduate Research Symposium', data['data']['response'])
        self.assertIn('ICSE Student Research Competition', data['data']['response'])
        tool_names = [tc['tool'] for tc in data['data']['toolCalls']]
        self.assertIn('query_conference_deadlines', tool_names)

    def test_search_course_catalog_tool_filters_and_attributes(self):
        # 1. Verify registered in get_inspection_tools
        tool_names = [t.name for t in get_inspection_tools()]
        self.assertIn('search_course_catalog', tool_names)

        # 2. Query specific course by code/keyword
        raw = search_course_catalog.invoke({'query': 'CSE 130', 'term': 'Winter 2027'})
        courses = json.loads(raw)
        self.assertGreaterEqual(len(courses), 1)
        cse130 = courses[0]
        self.assertEqual(cse130['code'], 'CSE 130')
        self.assertEqual(cse130['term'], 'Winter 2027')

        # Verify all CalendarEvent attributes are present
        required_attrs = ['id', 'title', 'type', 'days', 'startTime', 'endTime', 'credits', 'term', 'instructor', 'location', 'color']
        for attr in required_attrs:
            self.assertIn(attr, cse130, f"Missing required CalendarEvent attribute: {attr}")

        self.assertIsInstance(cse130['days'], list)
        self.assertGreaterEqual(len(cse130['days']), 1)
        self.assertTrue(re.match(r'^\d{2}:\d{2}$', cse130['startTime']))
        self.assertTrue(re.match(r'^\d{2}:\d{2}$', cse130['endTime']))
        self.assertIsInstance(cse130['credits'], (int, float))

        # 3. Query by department
        math_raw = search_course_catalog.invoke({'department': 'MATH', 'term': 'Winter 2027'})
        math_courses = json.loads(math_raw)
        self.assertGreaterEqual(len(math_courses), 1)
        for mc in math_courses:
            self.assertTrue(mc['department'] == 'MATH' or mc['code'].startswith('MATH'))

        # 4. Query by GE type
        ge_raw = search_course_catalog.invoke({'ge_type': 'CC', 'term': 'Winter 2027'})
        ge_courses = json.loads(ge_raw)
        self.assertGreaterEqual(len(ge_courses), 1)
        self.assertEqual(ge_courses[0]['ge'], 'CC')
        self.assertEqual(ge_courses[0]['code'], 'PHIL 11')

        # 5. Non-existent course query returns empty list
        empty_raw = search_course_catalog.invoke({'query': 'NONEXISTENT999'})
        empty_courses = json.loads(empty_raw)
        self.assertEqual(empty_courses, [])

    def test_process_query_course_recommendations_dual_output(self):
        payload = {
            'prompt': 'Recommend a 15-unit schedule for Winter 2027',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])

        # Verify dual-output format: response string and proposedCourses list
        self.assertIn('response', data['data'])
        self.assertIn('proposedCourses', data['data'])
        self.assertIn('toolCalls', data['data'])

        proposed = data['data']['proposedCourses']
        self.assertIsInstance(proposed, list)
        self.assertGreaterEqual(len(proposed), 3)

        # Verify each candidate satisfies CalendarEvent attributes
        for course in proposed:
            self.assertIn('id', course)
            self.assertIn('title', course)
            self.assertIn('type', course)
            self.assertIn('days', course)
            self.assertIn('startTime', course)
            self.assertIn('endTime', course)
            self.assertIn('credits', course)
            self.assertIn('color', course)
            self.assertIn('pinned', course)
            self.assertFalse(course['pinned'])

        # Verify toolCalls includes search_course_catalog
        tool_names = [tc['tool'] for tc in data['data']['toolCalls']]
        self.assertIn('search_course_catalog', tool_names)

    def test_process_query_pins_explicitly_requested_course(self):
        payload = {
            'prompt': 'I want CSE 130 on my schedule',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])

        proposed = data['data']['proposedCourses']
        self.assertGreaterEqual(len(proposed), 1)

        # Find CSE 130 and verify it is pinned
        cse130 = next((c for c in proposed if c.get('code') == 'CSE 130'), None)
        self.assertIsNotNone(cse130, "CSE 130 was not found in proposedCourses")
        self.assertTrue(cse130['pinned'])

        # Other complementary courses should not be pinned
        unpinned = [c for c in proposed if c.get('code') != 'CSE 130']
        for uc in unpinned:
            self.assertFalse(uc['pinned'])

    def test_process_query_pins_course_with_add_command(self):
        payload = {
            'prompt': 'Please add CSE 115A to my schedule',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {'targetCredits': 15},
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])

        proposed = data['data']['proposedCourses']
        cse115a = next((c for c in proposed if c.get('code') == 'CSE 115A'), None)
        self.assertIsNotNone(cse115a, "CSE 115A was not found in proposedCourses")
        self.assertTrue(cse115a['pinned'])

    def test_process_query_ge_requirements_proposes_ge_courses(self):
        payload = {
            'prompt': 'What GE requirements do I have left?',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {
                'geStatus': {'remaining': ['CC', 'ER'], 'source': 'UCSC'},
                'targetCredits': 15
            },
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])

        proposed = data['data']['proposedCourses']
        self.assertGreaterEqual(len(proposed), 2)

        # Should propose courses matching CC (PHIL 11) and ER (HIS 10A)
        proposed_codes = [c.get('code') for c in proposed]
        self.assertIn('PHIL 11', proposed_codes)
        self.assertIn('HIS 10A', proposed_codes)

    def test_replace_course_query(self):
        payload = {
            'prompt': 'replace math 21 with Math 19b',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {
                'targetCredits': 15
            },
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('replaced `MATH 21` with `MATH 19B`', data['data']['response'])
        proposed = data['data']['proposedCourses']
        math19b = next((c for c in proposed if c.get('code') == 'MATH 19B'), None)
        self.assertIsNotNone(math19b)
        self.assertTrue(math19b.get('pinned'))
        self.assertFalse(any(c.get('code') == 'MATH 21' for c in proposed))

    def test_replace_bare_numbers_query(self):
        payload = {
            'prompt': 'replace 19b with 23A',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {
                'targetCredits': 15
            },
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('replaced `MATH 19B` with `MATH 23A`', data['data']['response'])
        proposed = data['data']['proposedCourses']
        math23a = next((c for c in proposed if c.get('code') == 'MATH 23A'), None)
        self.assertIsNotNone(math23a)
        self.assertTrue(math23a.get('pinned'))

    def test_greeting_query(self):
        payload = {
            'prompt': 'hello',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {
                'targetCredits': 15
            },
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIn('SlugAgent Scheduling Advisor', data['data']['response'])
        self.assertIn('replace MATH 21 with MATH 19B', data['data']['response'])

    def test_multi_quarter_catalog_availability(self):
        terms = ['Fall 2026', 'Winter 2027', 'Spring 2027', 'Summer 2027']
        for t in terms:
            courses = find_courses(term=t)
            self.assertGreaterEqual(len(courses), 10, f"Expected at least 10 courses for {t}")
            for c in courses:
                self.assertEqual(c['term'], t)

    def test_agent_respects_target_term_preference(self):
        payload = {
            'prompt': 'Recommend core classes for next quarter',
            'student': {
                'name': 'Sammy Slug',
                'major': 'Computer Science B.S.',
                'standing': 'Junior'
            },
            'preferences': {
                'targetTerm': 'Spring 2027',
                'targetCredits': 15
            },
            'currentSchedule': [],
            'history': []
        }
        res = self.client.post('/api/agent/process/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        proposed = data['data']['proposedCourses']
        self.assertGreaterEqual(len(proposed), 1)
        for c in proposed:
            self.assertEqual(c['term'], 'Spring 2027')

    def test_dev_mode_honest_unavailable_message_without_api_key(self):
        import os
        from agent.agent import run_agent
        old_mock = os.environ.get('USE_MOCK_AGENT')
        old_gemini = os.environ.get('GEMINI_API_KEY')
        old_google = os.environ.get('GOOGLE_API_KEY')
        try:
            os.environ['USE_MOCK_AGENT'] = 'false'
            if 'GEMINI_API_KEY' in os.environ:
                del os.environ['GEMINI_API_KEY']
            if 'GOOGLE_API_KEY' in os.environ:
                del os.environ['GOOGLE_API_KEY']

            result = run_agent(
                prompt="hello",
                student={'name': 'Sammy'},
                preferences={'targetCredits': 15},
                schedule=[],
                history=[]
            )
            self.assertEqual(result['response'], "Sorry, SlugAgent is currently unavailable right now. It will be back shortly!")
            self.assertEqual(result['model'], "unavailable")
            self.assertEqual(result['proposedCourses'], [])
        finally:
            if old_mock is not None:
                os.environ['USE_MOCK_AGENT'] = old_mock
            else:
                os.environ['USE_MOCK_AGENT'] = 'true'
            if old_gemini is not None:
                os.environ['GEMINI_API_KEY'] = old_gemini
            if old_google is not None:
                os.environ['GOOGLE_API_KEY'] = old_google
