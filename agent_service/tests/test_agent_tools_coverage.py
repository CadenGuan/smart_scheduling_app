import os
import tempfile
import unittest
from pathlib import Path

from agent.catalog_dao import execute_safe_query, init_db, insert_course
from agent.degree_scraper import extract_degree_chunks_from_html, extract_degree_links
from agent.prereq_parser import (
    parse_prerequisite_text_llm,
    parse_prerequisite_text_rules,
    parse_prerequisites_from_db,
)
from agent.tools import (
    check_course_prerequisites,
    get_course_details,
    get_course_sections,
    get_course_time,
    set_tool_context,
)

FIXTURES_DIR = os.path.join(Path(__file__).resolve().parent, "fixtures")


class TestAgentToolsAndParserCoverage(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "cov_catalog.db")
        init_db(self.db_path)

        insert_course(
            {
                "course_code": "CSE 101",
                "section": "01",
                "title": "Data Structures",
                "credits": 5,
                "days": "Tu,Th",
                "start_time": "10:00",
                "end_time": "11:45",
                "room": "Baskin 152",
                "instructor": "Tantalo, P.",
                "raw_prereqs": "CSE 13S; and CSE 16 or MATH 21",
            },
            db_path=self.db_path,
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_prereq_parser_rules_variations(self):
        # Empty and None variations
        self.assertEqual(parse_prerequisite_text_rules("")["root_group"]["courses"], [])
        self.assertEqual(parse_prerequisite_text_rules("None")["root_group"]["courses"], [])
        self.assertEqual(parse_prerequisite_text_rules("N/A")["root_group"]["courses"], [])

        # Semicolon and or branches
        p1 = parse_prerequisite_text_rules("CSE 12; and CSE 16 or MATH 21")
        courses = p1["root_group"]["courses"]
        self.assertEqual(len(courses), 2)
        self.assertEqual(courses[0]["type"], "COURSE")
        self.assertEqual(courses[1]["type"], "OR")

        # LLM fallback when no key is set
        p_llm = parse_prerequisite_text_llm("CSE 20 or BME 160")
        self.assertIn("root_group", p_llm)

    def test_prerequisites_from_db_coverage(self):
        out_json = os.path.join(self.temp_dir.name, "out.json")
        dag = parse_prerequisites_from_db(
            db_path=self.db_path, output_json_path=out_json, use_offline_parser=True
        )
        self.assertIn("CSE 101", dag)

        # Non-existent DB path
        empty = parse_prerequisites_from_db("/nonexistent/path/db.sqlite")
        self.assertEqual(empty, {})

    def test_degree_links_extraction(self):
        fixture = os.path.join(FIXTURES_DIR, "bachelors_degrees.html")
        if os.path.exists(fixture):
            with open(fixture, "r") as f:
                html = f.read()
            links = extract_degree_links(html)
            self.assertGreaterEqual(len(links), 1)

    def test_degree_chunks_empty_fallback(self):
        minimal_html = "<html><body><h1>Minimal</h1><p>Requirements text here.</p></body></html>"
        chunks = extract_degree_chunks_from_html(
            minimal_html, degree_title="Test Degree", concentration="General"
        )
        self.assertGreaterEqual(len(chunks), 1)

    def test_catalog_dao_safe_query(self):
        res = execute_safe_query("SELECT count(*) as cnt FROM courses", db_path=self.db_path)
        self.assertEqual(res[0]["cnt"], 1)

    def test_tools_edge_cases(self):
        # Tools with empty/not found results
        from agent import catalog_dao

        old_path = catalog_dao.DEFAULT_DB_PATH
        catalog_dao.DEFAULT_DB_PATH = self.db_path
        try:
            details_not_found = get_course_details.invoke({"course_code": "NONEXISTENT"})
            self.assertIn("No course details found", details_not_found)

            sections_not_found = get_course_sections.invoke({"course_code": "NONEXISTENT"})
            self.assertIn("No active sections found", sections_not_found)

            time_not_found = get_course_time.invoke({"course_code": "NONEXISTENT"})
            self.assertIn("No schedule found", time_not_found)
        finally:
            catalog_dao.DEFAULT_DB_PATH = old_path

        # Context empty test
        set_tool_context({}, {}, [])
        prereq_res = check_course_prerequisites.invoke({"course_code": "CSE 101"})
        self.assertIsNotNone(prereq_res)

    def test_list_google_events_and_find_free_time(self):
        from agent.tools import find_free_time, list_google_events

        # Empty schedule
        set_tool_context({}, {}, [])
        self.assertIn("No external Google Calendar commitments found", list_google_events.invoke({}))
        self.assertIn("Free time windows of at least 60 minutes", find_free_time.invoke({}))

        # Populated schedule with imported event
        set_tool_context(
            {},
            {},
            [
                {
                    "title": "Work Shift",
                    "days": "Tuesday,Thursday",
                    "startTime": "10:00",
                    "endTime": "12:00",
                    "isImported": True,
                }
            ],
        )
        events_str = list_google_events.invoke({})
        self.assertIn("Work Shift", events_str)
        self.assertIn("Tuesday,Thursday", events_str)


if __name__ == "__main__":
    unittest.main()
