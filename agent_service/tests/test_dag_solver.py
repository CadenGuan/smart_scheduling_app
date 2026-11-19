import json
import os
import tempfile
import unittest

from agent.dag_solver import (
    evaluate_course_eligibility,
    is_eligible,
    load_course_dag,
    set_active_dag,
)


class TestDAGSolver(unittest.TestCase):
    def setUp(self):
        # Sample DAG matching course_dag.json schema
        self.sample_dag = {
            "CSE 40": {
                "root_group": {
                    "type": "AND",
                    "courses": [
                        {
                            "type": "OR",
                            "options": [
                                {"type": "COURSE", "course": "MATH 19B"},
                                {"type": "COURSE", "course": "MATH 20B"},
                            ],
                        },
                        {"type": "COURSE", "course": "CSE 30"},
                    ],
                }
            },
            "CSE 30": {
                "root_group": {
                    "type": "AND",
                    "courses": [
                        {
                            "type": "OR",
                            "options": [
                                {"type": "COURSE", "course": "CSE 20"},
                                {"type": "COURSE", "course": "BME 160"},
                            ],
                        },
                        {
                            "type": "OR",
                            "options": [
                                {"type": "COURSE", "course": "MATH 19A"},
                                {"type": "COURSE", "course": "MATH 11A"},
                            ],
                        },
                    ],
                }
            },
            "CSE 20": {
                "root_group": {
                    "type": "AND",
                    "courses": [],
                }
            },
        }
        set_active_dag(self.sample_dag)

    def test_course_with_no_prerequisites_is_always_eligible(self):
        node = self.sample_dag["CSE 20"]["root_group"]
        self.assertTrue(is_eligible(node, set()))

        res = evaluate_course_eligibility("CSE 20", [])
        self.assertTrue(res["is_eligible"])
        self.assertEqual(res["status"], "ELIGIBLE")

    def test_single_course_eligibility(self):
        course_node = {"type": "COURSE", "course": "CSE 30"}
        self.assertFalse(is_eligible(course_node, {"CSE 20"}))
        self.assertTrue(is_eligible(course_node, {"CSE 30"}))

    def test_or_group_eligibility(self):
        or_node = {
            "type": "OR",
            "options": [
                {"type": "COURSE", "course": "MATH 19B"},
                {"type": "COURSE", "course": "MATH 20B"},
            ],
        }
        self.assertFalse(is_eligible(or_node, set()))
        self.assertFalse(is_eligible(or_node, {"CSE 30"}))
        self.assertTrue(is_eligible(or_node, {"MATH 19B"}))
        self.assertTrue(is_eligible(or_node, {"MATH 20B"}))

    def test_nested_and_or_eligibility(self):
        # CSE 40 requires (MATH 19B OR MATH 20B) AND CSE 30
        cse40_root = self.sample_dag["CSE 40"]["root_group"]

        # Only MATH 19B -> missing CSE 30
        self.assertFalse(is_eligible(cse40_root, {"MATH 19B"}))

        # Only CSE 30 -> missing Math
        self.assertFalse(is_eligible(cse40_root, {"CSE 30"}))

        # MATH 19B + CSE 30 -> Eligible!
        self.assertTrue(is_eligible(cse40_root, {"MATH 19B", "CSE 30"}))

        # MATH 20B + CSE 30 -> Eligible!
        self.assertTrue(is_eligible(cse40_root, {"MATH 20B", "CSE 30"}))

        # Verify evaluate_course_eligibility wrapper
        res = evaluate_course_eligibility("CSE 40", ["MATH 19B", "CSE 30"])
        self.assertTrue(res["is_eligible"])
        self.assertEqual(res["status"], "ELIGIBLE")

        res_unmet = evaluate_course_eligibility("CSE 40", ["MATH 19B"])
        self.assertFalse(res_unmet["is_eligible"])
        self.assertEqual(res_unmet["status"], "NOT_ELIGIBLE")
        self.assertIn("CSE 30", res_unmet["message"])

    def test_unknown_course_fallback(self):
        res = evaluate_course_eligibility("UNKNOWN 999", ["CSE 20"])
        self.assertEqual(res["status"], "UNKNOWN_COURSE")

    def test_legacy_graph_functions(self):
        from agent.dag_solver import (
            audit_degree_progress,
            get_downstream_impact,
            get_prerequisite_chain,
        )

        # Unknown course
        res_unk = get_prerequisite_chain("NONEXISTENT", [])
        self.assertEqual(res_unk["status"], "UNKNOWN_COURSE")

        # Already completed
        res_comp = get_prerequisite_chain("CSE 12", ["CSE 12"])
        self.assertEqual(res_comp["status"], "ALREADY_COMPLETED")

        # Ready to enroll (CSE 20 has no prereqs in graph)
        res_ready = get_prerequisite_chain("CSE 20", [])
        self.assertEqual(res_ready["status"], "READY_TO_ENROLL")

        # Prerequisites needed
        res_needed = get_prerequisite_chain("CSE 30", [])
        self.assertEqual(res_needed["status"], "PREREQUISITES_NEEDED")

        # Downstream impact
        res_down_unk = get_downstream_impact("NONEXISTENT")
        self.assertEqual(res_down_unk["status"], "UNKNOWN_COURSE")

        res_down = get_downstream_impact("CSE 20")
        self.assertEqual(res_down["status"], "IMPACT_CALCULATED")
        self.assertIn("CSE 30", res_down["downstreamCourses"])

        # Audit degree progress
        audit = audit_degree_progress(["CSE 20", "MATH 19A"])
        self.assertGreaterEqual(audit["progressPercentage"], 0)
        self.assertIn("CSE 20", audit["completedCourses"])

    def test_prereq_parser_utilities(self):
        from agent.prereq_parser import (
            parse_prerequisite_text_llm,
            parse_prerequisite_text_rules,
            parse_prerequisites_from_db,
        )

        # Test rule parser fallback branch for non-course strings
        res = parse_prerequisite_text_rules(
            "instructor consent or sophomore standing; and good standing"
        )
        self.assertIn("root_group", res)

        # Test parse_prerequisite_text_llm without GEMINI_API_KEY (falls back to rules)
        res_llm = parse_prerequisite_text_llm("CSE 20 or CSE 30")
        self.assertIn("root_group", res_llm)

        # Test non-existent DB path
        self.assertEqual(parse_prerequisites_from_db("/nonexistent/catalog.db"), {})

    def test_node_formatting_and_edge_cases(self):
        from agent.dag_solver import format_node_requirements

        self.assertEqual(format_node_requirements(None), "None")
        self.assertEqual(format_node_requirements("CSE 20"), "CSE 20")
        self.assertEqual(format_node_requirements(123), "123")
        self.assertTrue(is_eligible(None, []))
        self.assertTrue(is_eligible("CSE 20", ["CSE 20"]))
        self.assertFalse(is_eligible("CSE 20", ["CSE 30"]))

        # Test load_course_dag with temp json
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"CSE 10": {"root_group": {"type": "AND", "courses": []}}}, f)
            temp_path = f.name
        try:
            loaded = load_course_dag(temp_path)
            self.assertIn("CSE 10", loaded)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


if __name__ == "__main__":
    unittest.main()
