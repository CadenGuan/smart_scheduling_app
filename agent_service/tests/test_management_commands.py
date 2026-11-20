import json
import os
import sqlite3
import tempfile
import unittest
from io import StringIO
from pathlib import Path

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "agent_service.settings")
django.setup()

from django.core.management import call_command  # noqa: E402

from agent.catalog_dao import init_db, insert_course  # noqa: E402

FIXTURES_DIR = os.path.join(Path(__file__).resolve().parent, "fixtures")


class TestManagementCommands(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_catalog.db")
        self.chroma_path = os.path.join(self.temp_dir.name, "chroma")
        self.dag_json_path = os.path.join(self.temp_dir.name, "course_dag.json")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_ingest_degrees_command_with_fixture(self):
        fixture_file = os.path.join(FIXTURES_DIR, "cs_bs.html")
        out = StringIO()
        call_command(
            "ingest_degrees",
            fixture_path=fixture_file,
            db_path=self.chroma_path,
            force_mock=True,
            stdout=out,
        )
        output_str = out.getvalue()
        self.assertIn("Successfully indexed", output_str)
        self.assertTrue(os.path.exists(self.chroma_path))

    def test_ingest_pisa_command_with_fixture(self):
        detail_fixture = os.path.join(FIXTURES_DIR, "pisa_detail.html")
        out = StringIO()
        temp_json = os.path.join(self.temp_dir.name, "exported_courses.json")
        call_command(
            "ingest_pisa",
            detail_fixture=detail_fixture,
            db_path=self.db_path,
            sync_courses_json=True,
            json_output=temp_json,
            stdout=out,
        )
        output_str = out.getvalue()
        self.assertIn("Successfully inserted", output_str)
        self.assertTrue(os.path.exists(temp_json))

        # Verify records in SQLite
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT course_code, section, section_type FROM courses")
        rows = cursor.fetchall()
        conn.close()

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0][0], "CSE 30")
        self.assertEqual(rows[0][1], "01")
        self.assertEqual(rows[0][2], "LECTURE")
        self.assertEqual(rows[1][1], "01A")
        self.assertEqual(rows[1][2], "DISCUSSION")

    def test_ingest_pisa_results_fixture(self):
        results_fixture = os.path.join(FIXTURES_DIR, "pisa_results.html")
        out = StringIO()
        call_command(
            "ingest_pisa",
            results_fixture=results_fixture,
            db_path=self.db_path,
            sync_courses_json=False,
            stdout=out,
        )
        output_str = out.getvalue()
        self.assertIn("Reading results fixture", output_str)
        self.assertIn("Found", output_str)

    def test_parse_prereq_dag_command(self):
        # Prepare test database with a course
        init_db(self.db_path)
        insert_course(
            {
                "course_code": "CSE 40",
                "section": "01",
                "title": "Machine Learning",
                "raw_prereqs": "MATH 19B or MATH 20B; and CSE 30",
            },
            db_path=self.db_path,
        )

        out = StringIO()
        call_command(
            "parse_prereq_dag",
            db_path=self.db_path,
            output=self.dag_json_path,
            use_offline_parser=True,
            stdout=out,
        )
        output_str = out.getvalue()
        self.assertIn("Successfully parsed", output_str)
        self.assertTrue(os.path.exists(self.dag_json_path))

        with open(self.dag_json_path, "r", encoding="utf-8") as f:
            dag = json.load(f)

        self.assertIn("CSE 40", dag)
        root = dag["CSE 40"]["root_group"]
        self.assertEqual(root["type"], "AND")
        self.assertEqual(len(root["courses"]), 2)
        # First item should be OR group
        self.assertEqual(root["courses"][0]["type"], "OR")
        options = [o["course"] for o in root["courses"][0]["options"]]
        self.assertIn("MATH 19B", options)
        self.assertIn("MATH 20B", options)


if __name__ == "__main__":
    import unittest

    unittest.main()
