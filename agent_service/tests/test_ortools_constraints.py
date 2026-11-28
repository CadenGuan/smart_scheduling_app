import unittest

from agent.schedule_solver import score_electives_for_goal, solve_schedule


class TestOrtoolsConstraintsAC1(unittest.TestCase):
    def test_ortools_constraints_ac1_explicit_elective_gets_core_priority(self):
        """ortools-constraints: AC1 - Explicit user-requested electives get core-level priority."""
        catalog = [
            {
                "course_code": "CSE 140",
                "section": "01",
                "title": "Artificial Intelligence",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "10:00",
                "end_time": "11:05",
                "section_type": "LECTURE",
            },
            {
                "course_code": "CSE 180",
                "section": "01",
                "title": "Database Systems",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "10:00",
                "end_time": "11:05",
                "section_type": "LECTURE",
            },
        ]
        result = solve_schedule(
            catalog=catalog,
            dag={},
            preferences={"targetCredits": 5},
            chat_context={"requestedElectives": ["CSE 140"]},
        )
        self.assertEqual(result["status"], "OPTIMAL")
        codes = {c["code"] for c in result["proposedCourses"]}
        self.assertEqual(codes, {"CSE 140"})

    def test_ortools_constraints_ac1_orientation_scoring_aligns_electives(self):
        """ortools-constraints: AC1 - Orientation goal scores eligible electives by alignment."""
        candidates = [
            {
                "course_code": "STAT 131",
                "title": "Introduction to Probability Theory and Statistical Inference",
                "description": "Probability distributions, statistical modeling, data science.",
            },
            {
                "course_code": "FILM 20A",
                "title": "Introduction to Film Studies",
                "description": "Cinema history, visual storytelling, and film analysis.",
            },
        ]
        scores = score_electives_for_goal(
            orientation_goal="I want to pursue machine learning and statistical data science",
            candidates=candidates,
        )
        self.assertGreater(scores["STAT 131"], scores["FILM 20A"])

        catalog = [
            {
                "course_code": "STAT 131",
                "section": "01",
                "title": "Introduction to Probability Theory",
                "credits": 5,
                "days": "Tu,Th",
                "start_time": "11:40",
                "end_time": "13:15",
                "section_type": "LECTURE",
            },
            {
                "course_code": "FILM 20A",
                "section": "01",
                "title": "Introduction to Film Studies",
                "credits": 5,
                "days": "Tu,Th",
                "start_time": "11:40",
                "end_time": "13:15",
                "section_type": "LECTURE",
            },
        ]
        result = solve_schedule(
            catalog=catalog,
            dag={},
            preferences={"targetCredits": 5},
            chat_context={
                "orientationGoal": "I want to pursue machine learning and statistical data science",
                "electiveDescriptions": {
                    "STAT 131": "Probability distributions, statistical modeling, data science.",
                    "FILM 20A": "Cinema history, visual storytelling, and film analysis.",
                },
            },
        )
        self.assertEqual(result["status"], "OPTIMAL")
        self.assertEqual({c["code"] for c in result["proposedCourses"]}, {"STAT 131"})

    def test_ortools_constraints_ac1_extraneous_courses_score_inversely_to_prereq_depth(self):
        """ortools-constraints: AC1 - Extraneous courses with shorter prereq chains rank higher."""
        catalog = [
            {
                "course_code": "ECON 100A",
                "section": "01",
                "title": "Intermediate Microeconomics",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "13:20",
                "end_time": "14:25",
                "section_type": "LECTURE",
            },
            {
                "course_code": "ART 10F",
                "section": "01",
                "title": "Intro to Visual Art",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "13:20",
                "end_time": "14:25",
                "section_type": "LECTURE",
            },
        ]
        dag = {
            "ECON 1": {"root_group": {"type": "AND", "courses": []}},
            "ECON 2": {
                "root_group": {"type": "AND", "courses": [{"type": "COURSE", "course": "ECON 1"}]}
            },
            "ECON 100A": {
                "root_group": {"type": "AND", "courses": [{"type": "COURSE", "course": "ECON 2"}]}
            },
            "ART 10F": {"root_group": {"type": "AND", "courses": []}},
        }
        result = solve_schedule(
            catalog=catalog,
            dag=dag,
            completed_courses=["ECON 1", "ECON 2"],
            preferences={"targetCredits": 5},
            chat_context={"extraneousCourses": ["ECON 100A", "ART 10F"]},
        )
        self.assertEqual(result["status"], "OPTIMAL")
        self.assertEqual({c["code"] for c in result["proposedCourses"]}, {"ART 10F"})

    def test_ortools_constraints_ac2_at_most_one_course_per_ge_category(self):
        """ortools-constraints: AC2 - Enforces <= 1 course per GE category."""
        catalog = [
            {
                "course_code": "MATH 19A",
                "section": "01",
                "title": "Calculus",
                "credits": 5,
                "ge": "SR",
                "days": "M,W,F",
                "start_time": "09:00",
                "end_time": "10:05",
                "section_type": "LECTURE",
            },
            {
                "course_code": "AM 20",
                "section": "01",
                "title": "Differential Equations",
                "credits": 5,
                "ge": "SR",
                "days": "Tu,Th",
                "start_time": "10:00",
                "end_time": "11:35",
                "section_type": "LECTURE",
            },
            {
                "course_code": "ART 10F",
                "section": "01",
                "title": "Intro Art",
                "credits": 5,
                "ge": "IM",
                "days": "Tu,Th",
                "start_time": "13:00",
                "end_time": "14:35",
                "section_type": "LECTURE",
            },
        ]
        result = solve_schedule(
            catalog=catalog,
            dag={},
            preferences={"targetCredits": 15},
        )
        self.assertEqual(result["status"], "OPTIMAL")
        sr_courses = [c for c in result["proposedCourses"] if c.get("ge") == "SR"]
        self.assertLessEqual(len(sr_courses), 1)
        self.assertEqual(len(sr_courses), 1)
        self.assertIn("ART 10F", {c["code"] for c in result["proposedCourses"]})

    def test_ortools_constraints_ac2_soft_12_unit_floor_and_infeasible_reason(self):
        """ortools-constraints: AC2 - Soft >=12 unit floor and clear INFEASIBLE diagnostics."""
        # Case A: Only 10 units available -> still OPTIMAL (soft floor doesn't break)
        small_catalog = [
            {
                "course_code": "CSE 20",
                "section": "01",
                "title": "Intro Python",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "09:00",
                "end_time": "10:05",
                "section_type": "LECTURE",
            },
            {
                "course_code": "ART 10F",
                "section": "01",
                "title": "Intro Art",
                "credits": 5,
                "days": "Tu,Th",
                "start_time": "10:00",
                "end_time": "11:35",
                "section_type": "LECTURE",
            },
        ]
        res_small = solve_schedule(
            catalog=small_catalog,
            dag={},
            preferences={"targetCredits": 15},
        )
        self.assertEqual(res_small["status"], "OPTIMAL")
        self.assertEqual(res_small["totalCredits"], 10)

        # Case B: Required 5-credit course exceeds targetCredits=3 -> INFEASIBLE with reason
        res_infeasible = solve_schedule(
            catalog=small_catalog,
            dag={},
            preferences={"targetCredits": 3},
            chat_context={"requiredCourses": ["CSE 20"]},
        )
        self.assertEqual(res_infeasible["status"], "INFEASIBLE")
        self.assertTrue(res_infeasible["reason"])
        self.assertIn("CSE 20", res_infeasible["reason"])

    def test_ortools_constraints_ac3_preferred_gap_time_maximizes_matching_pairs(self):
        """ortools-constraints: AC3 - OnlyEnforceIf gap bonuses pick sections matching preferredGapMinutes."""
        catalog = [
            {
                "course_code": "CSE 20",
                "section": "01",
                "title": "Intro Python",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "10:00",
                "end_time": "11:00",
                "section_type": "LECTURE",
            },
            {
                "course_code": "ART 10F",
                "section": "01",
                "title": "Intro Art",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "11:30",
                "end_time": "12:30",
                "section_type": "LECTURE",
            },
            {
                "course_code": "ART 10F",
                "section": "02",
                "title": "Intro Art",
                "credits": 5,
                "days": "M,W,F",
                "start_time": "14:00",
                "end_time": "15:00",
                "section_type": "LECTURE",
            },
        ]

        res_30 = solve_schedule(
            catalog=catalog,
            dag={},
            preferences={"targetCredits": 10},
            chat_context={"preferredGapMinutes": 30},
        )
        self.assertEqual(res_30["status"], "OPTIMAL")
        self.assertIn("art-10f-01", {c["id"] for c in res_30["proposedCourses"]})

        res_180 = solve_schedule(
            catalog=catalog,
            dag={},
            preferences={"targetCredits": 10},
            chat_context={"preferredGapMinutes": 180},
        )
        self.assertEqual(res_180["status"], "OPTIMAL")
        self.assertIn("art-10f-02", {c["id"] for c in res_180["proposedCourses"]})
