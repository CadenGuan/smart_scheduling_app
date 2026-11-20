"""GT22: the agent uses the GE requirements a student checked off as satisfied.

Each test name starts with the task ID after pytest's required ``test_`` prefix.
"""

import json
import re

from django.test import Client, TestCase

from agent.tools import find_courses, query_degree_ge_requirements, set_tool_context

ALL_GE_CODES = ["CC", "ER", "IM", "MF", "SI", "SR", "TA", "PE", "PR", "C", "DC"]
STUDENT = {"name": "Sammy Slug", "major": "Computer Science B.S.", "standing": "Junior"}


def _ge_status(completed):
    return {
        "source": "UCSC",
        "completed": completed,
        "remaining": [c for c in ALL_GE_CODES if c not in completed],
    }


def _course_ge_codes(course):
    raw = course.get("ge") or []
    if isinstance(raw, str):
        raw = [raw]
    # PE-H / PR-C etc. satisfy the parent PE / PR requirement
    return {str(g).strip().upper().split("-")[0] for g in raw}


class GT22GeToolTests(TestCase):
    def test_GT22_tool_returns_completed_and_remaining_ges(self):
        completed = ["CC", "ER", "TA"]
        set_tool_context(STUDENT, {"geStatus": _ge_status(completed)}, [])

        result = json.loads(query_degree_ge_requirements.invoke({}))
        self.assertEqual(sorted(result["completedGEs"]), sorted(completed))
        self.assertEqual(
            sorted(result["remainingGEs"]),
            sorted(c for c in ALL_GE_CODES if c not in completed),
        )
        self.assertEqual(result["geSource"], "UCSC")

    def test_GT22_tool_completed_and_remaining_never_overlap(self):
        set_tool_context(STUDENT, {"geStatus": _ge_status(["MF", "SI", "PR"])}, [])
        result = json.loads(query_degree_ge_requirements.invoke({}))
        self.assertEqual(set(result["completedGEs"]) & set(result["remainingGEs"]), set())

    def test_GT22_tool_legacy_status_without_completed_returns_empty_completed(self):
        set_tool_context(STUDENT, {"geStatus": {"source": "UCSC", "remaining": ["IM"]}}, [])
        result = json.loads(query_degree_ge_requirements.invoke({}))
        self.assertEqual(result["remainingGEs"], ["IM"])
        self.assertEqual(result["completedGEs"], [])

    def test_GT22_tool_missing_ge_status_assumes_nothing_completed(self):
        set_tool_context(STUDENT, {}, [])
        result = json.loads(query_degree_ge_requirements.invoke({}))
        self.assertEqual(result["completedGEs"], [])


class GT22GeAgentTests(TestCase):
    def setUp(self):
        self.client = Client()

    def _ask(self, prompt, completed):
        payload = {
            "prompt": prompt,
            "student": STUDENT,
            "preferences": {"geStatus": _ge_status(completed), "targetCredits": 15},
            "currentSchedule": [],
            "history": [],
        }
        res = self.client.post(
            "/api/agent/process/", data=json.dumps(payload), content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        return data["data"]

    def test_GT22_agent_does_not_list_checked_off_ges_as_remaining(self):
        completed = [c for c in ALL_GE_CODES if c not in ("TA", "IM")]
        data = self._ask("What GEs do I still need?", completed)
        response = data["response"]

        self.assertIn("TA", response)
        self.assertIn("IM", response)
        for done in ("CC", "ER", "PR"):
            self.assertIsNone(
                re.search(rf"`{done}`", response),
                f"{done} was checked off but the agent still mentions it as a GE: {response}",
            )

    def test_GT22_agent_does_not_propose_courses_for_satisfied_ges(self):
        completed = ["CC", "ER", "PR"]
        data = self._ask("What GE requirements do I have left?", completed)

        for course in data.get("proposedCourses", []):
            overlap = _course_ge_codes(course) & set(completed)
            self.assertFalse(
                overlap,
                f"{course.get('code')} only helps with GEs already satisfied: {overlap}",
            )

    def test_GT22_agent_proposes_courses_for_a_remaining_ge(self):
        # Use a remaining GE the mock catalog actually offers this term
        offered = next(
            (g for g in ALL_GE_CODES if find_courses(ge_type=g, term="Winter 2027")), None
        )
        self.assertIsNotNone(offered, "mock catalog offers no GE courses for Winter 2027")
        completed = [c for c in ALL_GE_CODES if c != offered]

        data = self._ask("What GEs do I still need?", completed)
        proposed_ges = set().union(*(_course_ge_codes(c) for c in data["proposedCourses"]))
        self.assertIn(offered, proposed_ges)

    def test_GT22_agent_all_ges_satisfied_proposes_no_ge_courses(self):
        data = self._ask("What GEs do I have left?", list(ALL_GE_CODES))
        self.assertRegex(data["response"].lower(), r"complet|satisf|all")

        for course in data.get("proposedCourses", []):
            self.assertFalse(
                _course_ge_codes(course) & set(ALL_GE_CODES),
                f"proposed GE course {course.get('code')} although every GE is satisfied",
            )
