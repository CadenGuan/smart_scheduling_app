import os
import tempfile
import unittest

from agent.catalog_dao import (
    bulk_insert_courses,
    execute_safe_query,
    get_course_details,
    get_course_sections,
    get_course_time,
    init_db,
    insert_course,
    sanitize_value,
)


class TestCatalogDAO(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_academic_catalog.db")
        init_db(self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_sanitize_value_whitespace_trimming(self):
        self.assertEqual(sanitize_value("  CSE 30  "), "CSE 30")
        self.assertEqual(sanitize_value("\n\tM,W,F \t"), "M,W,F")
        self.assertEqual(sanitize_value(5), 5)
        self.assertIsNone(sanitize_value(None))

    def test_insert_and_verify_whitespace_stripped(self):
        course = {
            "course_code": "  CSE 30 ",
            "section": " 01 ",
            "title": "  Programming Abstractions in Python  ",
            "credits": 5,
            "ge": " MF ",
            "class_number": " 20451 ",
            "days": " M,W,F ",
            "start_time": " 13:20 ",
            "end_time": " 14:25 ",
            "room": " Classroom Unit 002 ",
            "instructor": " Alfvén, H. ",
            "meeting_dates": " 01/06/27-03/19/27 ",
            "raw_prereqs": " CSE 20 or BME 160 ",
            "section_type": " LECTURE ",
            "status": " Open ",
        }
        row_id = insert_course(course, db_path=self.db_path)
        self.assertGreater(row_id, 0)

        rows = get_course_details("cse 30", db_path=self.db_path)
        self.assertEqual(len(rows), 1)
        r = rows[0]
        self.assertEqual(r["course_code"], "CSE 30")
        self.assertEqual(r["section"], "01")
        self.assertEqual(r["title"], "Programming Abstractions in Python")
        self.assertEqual(r["ge"], "MF")
        self.assertEqual(r["class_number"], "20451")
        self.assertEqual(r["days"], "M,W,F")
        self.assertEqual(r["start_time"], "13:20")
        self.assertEqual(r["end_time"], "14:25")
        self.assertEqual(r["room"], "Classroom Unit 002")
        self.assertEqual(r["instructor"], "Alfvén, H.")
        self.assertEqual(r["meeting_dates"], "01/06/27-03/19/27")
        self.assertEqual(r["raw_prereqs"], "CSE 20 or BME 160")
        self.assertEqual(r["section_type"], "LECTURE")
        self.assertEqual(r["status"], "Open")

    def test_discussion_sections_handling(self):
        courses = [
            {
                "course_code": "CSE 30",
                "section": "01",
                "title": "Programming Abstractions in Python",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "13:20",
                "end_time": "14:25",
                "meeting_dates": "01/06/27-03/19/27",
                "section_type": "LECTURE",
            },
            {
                "course_code": "CSE 30",
                "section": "01A",
                "title": "Programming Abstractions in Python",
                "credits": None,
                "days": "Tu",
                "start_time": "09:00",
                "end_time": "10:05",
                "room": "Jack Baskin Engr 109",
                "instructor": "Staff",
                "meeting_dates": "01/06/27-03/19/27",
                "section_type": "DISCUSSION",
                "status": "Open",
            },
        ]
        bulk_insert_courses(courses, db_path=self.db_path)

        sections = get_course_sections("CSE 30", db_path=self.db_path)
        self.assertEqual(len(sections), 2)
        sec_types = {s["section"]: s["section_type"] for s in sections}
        self.assertEqual(sec_types["01"], "LECTURE")
        self.assertEqual(sec_types["01A"], "DISCUSSION")

        # Test specific section time lookup
        time_info = get_course_time("CSE 30", "01A", db_path=self.db_path)
        self.assertIsNotNone(time_info)
        self.assertEqual(time_info["days"], "Tu")
        self.assertEqual(time_info["start_time"], "09:00")
        self.assertEqual(time_info["end_time"], "10:05")

    def test_lookup_nonexistent_course(self):
        details = get_course_details("NONEXISTENT 999", db_path=self.db_path)
        self.assertEqual(details, [])
        time_info = get_course_time("NONEXISTENT 999", "01", db_path=self.db_path)
        self.assertIsNone(time_info)

    def test_invalid_database_operations(self):
        """Acceptance Criteria: Database creation & operations (including invalid ones)"""
        # Malformed SQL query
        with self.assertRaises(ValueError):
            execute_safe_query("SELECT * FROM non_existent_table", db_path=self.db_path)

        with self.assertRaises(ValueError):
            execute_safe_query("THIS IS INVALID SQL SYNTAX", db_path=self.db_path)


if __name__ == "__main__":
    unittest.main()
