import os
import unittest
from pathlib import Path

from agent.pisa_scraper import parse_pisa_detail_page, parse_pisa_results_page, parse_time

FIXTURES_DIR = os.path.join(Path(__file__).resolve().parent, "fixtures")


class TestPisaScraper(unittest.TestCase):
    def test_parse_time_regex(self):
        # Standard MWF afternoon class
        res = parse_time("MWF 01:20PM-02:25PM")
        self.assertIsNotNone(res)
        self.assertEqual(res["days"], ["M", "W", "F"])
        self.assertEqual(res["start_time"], "13:20")
        self.assertEqual(res["end_time"], "14:25")

        # Tuesday/Thursday morning class
        res2 = parse_time("TuTh 09:50AM-11:25AM")
        self.assertIsNotNone(res2)
        self.assertEqual(res2["days"], ["Tu", "Th"])
        self.assertEqual(res2["start_time"], "09:50")
        self.assertEqual(res2["end_time"], "11:25")

        # Invalid/empty formats
        self.assertIsNone(parse_time(""))
        self.assertIsNone(parse_time("TBA"))

    def test_parse_results_page(self):
        results_file = os.path.join(FIXTURES_DIR, "pisa_results.html")
        if not os.path.exists(results_file):
            self.skipTest("pisa_results.html fixture not found")

        with open(results_file, "r", encoding="utf-8") as f:
            html = f.read()

        classes = parse_pisa_results_page(html)
        self.assertEqual(len(classes), 2)
        self.assertEqual(classes[0]["class_number"], "20451")
        self.assertIn("class_data=test_cse_30_01", classes[0]["detail_url"])

    def test_parse_detail_page_lecture_and_discussion(self):
        detail_file = os.path.join(FIXTURES_DIR, "pisa_detail.html")
        if not os.path.exists(detail_file):
            self.skipTest("pisa_detail.html fixture not found")

        with open(detail_file, "r", encoding="utf-8") as f:
            html = f.read()

        records = parse_pisa_detail_page(html)
        self.assertEqual(len(records), 2)

        lecture = records[0]
        self.assertEqual(lecture["course_code"], "CSE 30")
        self.assertEqual(lecture["section"], "01")
        self.assertEqual(lecture["title"], "Programming Abstractions in Python")
        self.assertEqual(lecture["credits"], 5)
        self.assertEqual(lecture["ge"], "MF")
        self.assertEqual(lecture["class_number"], "20451")
        self.assertEqual(lecture["days"], "M,W,F")
        self.assertEqual(lecture["start_time"], "13:20")
        self.assertEqual(lecture["end_time"], "14:25")
        self.assertEqual(lecture["section_type"], "LECTURE")
        self.assertEqual(lecture["raw_prereqs"], "CSE 20 or BME 160; and MATH 19A or MATH 11A.")

        discussion = records[1]
        self.assertEqual(discussion["course_code"], "CSE 30")
        self.assertEqual(discussion["section"], "01A")
        self.assertEqual(discussion["section_type"], "DISCUSSION")
        self.assertEqual(discussion["days"], "Tu")
        self.assertEqual(discussion["start_time"], "09:00")
        self.assertEqual(discussion["end_time"], "10:05")
        self.assertEqual(discussion["room"], "Jack Baskin Engr 109")
        self.assertEqual(discussion["instructor"], "Staff")
        self.assertEqual(discussion["meeting_dates"], lecture["meeting_dates"])


if __name__ == "__main__":
    unittest.main()
