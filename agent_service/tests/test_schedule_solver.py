import unittest

from agent.schedule_solver import solve_schedule


def _to_minutes(hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def _assert_no_overlaps(events: list[dict], busy_blocks: list[dict] | None = None) -> None:
    """Asserts zero overlapping intervals across all scheduled events and busy blocks."""
    by_day: dict[str, list[tuple[int, int, str]]] = {}
    for ev in events + (busy_blocks or []):
        start = _to_minutes(ev["startTime"])
        end = _to_minutes(ev["endTime"])
        for day in ev.get("days", []):
            by_day.setdefault(day, []).append((start, end, ev.get("code") or ev.get("title", "")))

    for day, intervals in by_day.items():
        intervals.sort(key=lambda x: x[0])
        for i in range(len(intervals) - 1):
            s1, e1, name1 = intervals[i]
            s2, e2, name2 = intervals[i + 1]
            assert e1 <= s2, f"Overlap on {day}: {name1} ({s1}-{e1}) vs {name2} ({s2}-{e2})"


class TestOrtoolsSchedulerAC1(unittest.TestCase):
    def test_ortools_scheduler_ac1_deduplicates_skips_tba_and_avoids_busy_conflicts(self):
        """ortools-scheduler: AC1 - Zero overlaps across lectures, discussions, and busy blocks."""
        catalog = [
            # Duplicate row (mirrors live PISA DB quirk)
            {
                "course_code": "CSE 101",
                "section": "01",
                "title": "Data Structures",
                "credits": 5,
                "ge": None,
                "days": "M,W,F",
                "start_time": "12:00",
                "end_time": "13:05",
                "room": "Kresge 3105",
                "instructor": "Harrison, D.",
                "section_type": "LECTURE",
            },
            {
                "course_code": "CSE 101",
                "section": "01",
                "title": "Data Structures",
                "credits": 5,
                "ge": None,
                "days": "M,W,F",
                "start_time": "12:00",
                "end_time": "13:05",
                "room": "Kresge 3105",
                "instructor": "Harrison, D.",
                "section_type": "LECTURE",
            },
            # Non-overlapping alternative for CSE 101
            {
                "course_code": "CSE 101",
                "section": "02",
                "title": "Data Structures",
                "credits": 5,
                "ge": None,
                "days": "Tu,Th",
                "start_time": "11:40",
                "end_time": "13:15",
                "room": "EarthSci B206",
                "instructor": "Tantalo, P.",
                "section_type": "LECTURE",
            },
            # Overlaps with CSE 101 [02] on Tu,Th
            {
                "course_code": "CSE 130",
                "section": "01",
                "title": "Computer Systems",
                "credits": 5,
                "ge": None,
                "days": "Tu,Th",
                "start_time": "12:00",
                "end_time": "13:35",
                "room": "Jack Baskin 152",
                "instructor": "Quinn, A.",
                "section_type": "LECTURE",
            },
            # Non-overlapping alternative for CSE 130
            {
                "course_code": "CSE 130",
                "section": "02",
                "title": "Computer Systems",
                "credits": 5,
                "ge": None,
                "days": "M,W,F",
                "start_time": "14:00",
                "end_time": "15:05",
                "room": "Jack Baskin 152",
                "instructor": "Quinn, A.",
                "section_type": "LECTURE",
            },
            # TBA row (must be skipped safely without crashing)
            {
                "course_code": "CSE 115A",
                "section": "01",
                "title": "Software Engineering",
                "credits": 5,
                "ge": None,
                "days": None,
                "start_time": "TBA",
                "end_time": "TBA",
                "room": "TBA",
                "instructor": "Staff",
                "section_type": "LECTURE",
            },
        ]

        busy_blocks = [
            {
                "id": "gcal-work-1",
                "code": "BUSY",
                "title": "Work Shift",
                "type": "GOOGLE_CALENDAR_BUSY",
                "days": ["Monday", "Wednesday", "Friday"],
                "startTime": "12:00",
                "endTime": "13:00",
                "credits": 0,
            }
        ]

        result = solve_schedule(
            catalog=catalog,
            dag={},
            completed_courses=[],
            preferences={"targetCredits": 15, "targetTerm": "Winter 2027"},
            busy_blocks=busy_blocks,
        )

        self.assertEqual(result["status"], "OPTIMAL")
        proposed = result["proposedCourses"]
        self.assertGreaterEqual(len(proposed), 2)

        # No duplicate (code, id) entries
        ids = [c["id"] for c in proposed]
        self.assertEqual(len(ids), len(set(ids)))

        # CSE 101 [01] must NOT be chosen because it conflicts with GCal busy block
        self.assertNotIn("cse-101-01", ids)
        self.assertIn("cse-101-02", ids)
        self.assertIn("cse-130-02", ids)

        # Zero overlaps across all proposed courses + busy blocks
        _assert_no_overlaps(proposed, busy_blocks)

        # CalendarEventSchema shape check
        for ev in proposed:
            self.assertIn("code", ev)
            self.assertIn("days", ev)
            self.assertIsInstance(ev["days"], list)
            self.assertRegex(ev["startTime"], r"^\d{2}:\d{2}$")
            self.assertRegex(ev["endTime"], r"^\d{2}:\d{2}$")

    def test_ortools_scheduler_ac1_solve_endpoint_returns_conflict_free_schedule(self):
        """ortools-scheduler: AC1 - POST /api/agent/solve/ returns OPTIMAL non-overlapping schedule."""
        import json

        from django.test import Client

        client = Client()
        payload = {
            "dag": {},
            "preferences": {"targetCredits": 10, "targetTerm": "Winter 2027"},
            "currentSchedule": [
                {
                    "id": "gcal-1",
                    "title": "Busy",
                    "type": "GOOGLE_CALENDAR_BUSY",
                    "days": ["Monday", "Wednesday", "Friday"],
                    "startTime": "12:00",
                    "endTime": "13:00",
                }
            ],
            "catalog": [
                {
                    "course_code": "CSE 101",
                    "section": "01",
                    "title": "Data Structures",
                    "credits": 5,
                    "days": "M,W,F",
                    "start_time": "12:00",
                    "end_time": "13:05",
                    "section_type": "LECTURE",
                },
                {
                    "course_code": "CSE 101",
                    "section": "02",
                    "title": "Data Structures",
                    "credits": 5,
                    "days": "Tu,Th",
                    "start_time": "11:40",
                    "end_time": "13:15",
                    "section_type": "LECTURE",
                },
            ],
        }
        resp = client.post(
            "/api/agent/solve/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["status"], "OPTIMAL")
        ids = [c["id"] for c in body["data"]["proposedCourses"]]
        self.assertIn("cse-101-02", ids)
        self.assertNotIn("cse-101-01", ids)

    def test_ortools_scheduler_ac1_tool_is_registered_in_inspection_tools(self):
        """ortools-scheduler: AC1 - solve_schedule_tool is registered for the live agent."""
        from agent.tools import get_inspection_tools

        tool_names = [getattr(t, "name", "") for t in get_inspection_tools()]
        self.assertIn("solve_schedule_tool", tool_names)

    def test_ortools_scheduler_ac1_never_picks_orphan_discussions_without_lecture(self):
        """ortools-scheduler: AC1 - Free 0-credit discussions cannot be picked without their lecture."""
        catalog = [
            {
                "course_code": "CSE 20",
                "section": "01",
                "title": "Intro Python",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "10:00",
                "end_time": "11:05",
                "section_type": "LECTURE",
            },
            {
                "course_code": "CSE 20",
                "section": "01A",
                "title": "Intro Python",
                "credits": None,
                "days": "Tu",
                "start_time": "09:00",
                "end_time": "10:05",
                "section_type": "DISCUSSION",
            },
            {
                "course_code": "CSE 20",
                "section": "01B",
                "title": "Intro Python",
                "credits": None,
                "days": "Th",
                "start_time": "09:00",
                "end_time": "10:05",
                "section_type": "DISCUSSION",
            },
            # Course whose only lecture conflicts with busy block -> its discussions must NOT be picked!
            {
                "course_code": "CSE 30",
                "section": "01",
                "title": "Abstractions",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "12:00",
                "end_time": "13:05",
                "section_type": "LECTURE",
            },
            {
                "course_code": "CSE 30",
                "section": "01A",
                "title": "Abstractions",
                "credits": None,
                "days": "F",
                "start_time": "15:00",
                "end_time": "16:05",
                "section_type": "DISCUSSION",
            },
        ]
        busy_blocks = [
            {
                "id": "busy-1",
                "title": "Work",
                "type": "GOOGLE_CALENDAR_BUSY",
                "days": ["Monday", "Wednesday", "Friday"],
                "startTime": "12:00",
                "endTime": "13:00",
            }
        ]
        result = solve_schedule(
            catalog=catalog,
            dag={},
            preferences={"targetCredits": 10},
            busy_blocks=busy_blocks,
        )
        self.assertEqual(result["status"], "OPTIMAL")
        proposed = result["proposedCourses"]
        codes_types = [(c["code"], c["sectionType"]) for c in proposed]
        self.assertIn(("CSE 20", "LECTURE"), codes_types)
        self.assertEqual(codes_types.count(("CSE 20", "DISCUSSION")), 1)
        # CSE 30 lecture is blocked, so CSE 30 discussion must NOT be picked as an orphan!
        self.assertNotIn(("CSE 30", "DISCUSSION"), codes_types)

    def test_ortools_scheduler_ac5_prereq_regex_guard_drops_prose(self):
        """ortools-scheduler: AC5 - parse_prerequisite_text_rules drops non-course prose."""
        from agent.prereq_parser import parse_prerequisite_text_rules

        mixed = parse_prerequisite_text_rules(
            "CSE 13S; and by instructor permission. Enrollment is restricted to CS majors."
        )
        courses_mixed = mixed["root_group"]["courses"]
        self.assertEqual(courses_mixed, [{"type": "COURSE", "course": "CSE 13S"}])

        prose_only = parse_prerequisite_text_rules(
            "Data structures and algorithm design: balanced search trees and dynamic programming."
        )
        self.assertEqual(prose_only["root_group"]["courses"], [])

    def test_ortools_scheduler_ac5_prereq_eligibility_lab_coreq_and_core_priority(self):
        """ortools-scheduler: AC5 - Enforces prereq eligibility, L-lab coreq, and core priority."""
        catalog = [
            # Eligible core course that unlocks CSE 101 -> CSE 130 (high priority)
            {
                "course_code": "CSE 13S",
                "section": "01",
                "title": "Computer Systems and C",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "10:00",
                "end_time": "11:05",
                "section_type": "LECTURE",
            },
            # Ineligible (requires CSE 13S)
            {
                "course_code": "CSE 101",
                "section": "01",
                "title": "Data Structures",
                "credits": 5,
                "days": "Tu,Th",
                "start_time": "11:40",
                "end_time": "13:15",
                "section_type": "LECTURE",
            },
            # Lab without CSE 100 in catalog or completed -> must NOT be picked!
            {
                "course_code": "CSE 100L",
                "section": "01",
                "title": "Logic Design Lab",
                "credits": 2,
                "days": "M",
                "start_time": "14:00",
                "end_time": "15:30",
                "section_type": "LECTURE",
            },
            # Lower-priority non-unlocking course overlapping CSE 13S
            {
                "course_code": "ART 10F",
                "section": "01",
                "title": "Intro Art",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "10:00",
                "end_time": "11:05",
                "section_type": "LECTURE",
            },
        ]
        dag = {
            "CSE 13S": {
                "root_group": {"type": "AND", "courses": [{"type": "COURSE", "course": "CSE 30"}]}
            },
            "CSE 101": {
                "root_group": {"type": "AND", "courses": [{"type": "COURSE", "course": "CSE 13S"}]}
            },
            "CSE 100L": {"root_group": {"type": "AND", "courses": []}},
            "ART 10F": {"root_group": {"type": "AND", "courses": []}},
        }
        result = solve_schedule(
            catalog=catalog,
            dag=dag,
            completed_courses=["CSE 20", "CSE 30"],
            preferences={"targetCredits": 10},
        )
        self.assertEqual(result["status"], "OPTIMAL")
        codes = {c["code"] for c in result["proposedCourses"]}
        self.assertIn("CSE 13S", codes)
        self.assertNotIn("CSE 101", codes)
        self.assertNotIn("CSE 100L", codes)
        self.assertNotIn("ART 10F", codes)

    def test_ortools_scheduler_ac3_discussion_title_and_unique_chat_summary(self):
        """ortools-scheduler: AC3 - Discussions are titled '<CODE> Discussion' and chat lists each course once."""
        from unittest.mock import patch

        from agent.mock_agent import run_mock_agent

        catalog = [
            {
                "course_code": "CSE 20",
                "section": "01",
                "title": "Intro Python",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "10:00",
                "end_time": "11:05",
                "section_type": "LECTURE",
            },
            {
                "course_code": "CSE 20",
                "section": "01A",
                "title": "Intro Python",
                "credits": None,
                "days": "Tu",
                "start_time": "09:00",
                "end_time": "10:05",
                "section_type": "DISCUSSION",
            },
        ]

        result = solve_schedule(catalog=catalog, dag={}, preferences={"targetCredits": 10})
        discs = [c for c in result["proposedCourses"] if c["sectionType"] == "DISCUSSION"]
        self.assertEqual(len(discs), 1)
        self.assertEqual(discs[0]["title"], "CSE 20 Discussion")

        with (
            patch("agent.schedule_solver.load_catalog_for_solver", return_value=catalog),
            patch("agent.schedule_solver.load_course_dag", return_value={}),
        ):
            agent_res = run_mock_agent(
                prompt="optimize my schedule",
                student={"name": "Sammy", "major": "Computer Science B.S.", "standing": "Freshman"},
                preferences={"targetCredits": 10, "targetTerm": "Winter 2027"},
                schedule=[],
                history=[],
            )
        self.assertEqual(agent_res["response"].count("`CSE 20`"), 1)
