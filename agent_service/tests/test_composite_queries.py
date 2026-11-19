import os
import unittest
import tempfile
from pathlib import Path
from agent.tools import (
    set_tool_context,
    query_degree_requirements,
    get_course_details,
    get_course_sections,
    get_course_time,
    check_course_prerequisites,
    get_inspection_tools,
)
from agent.catalog_dao import init_db, bulk_insert_courses
from agent.chroma_rag import get_or_create_collection, add_degree_chunks
from agent.dag_solver import set_active_dag


class TestCompositeQueriesAndTools(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_academic_catalog.db")
        init_db(self.db_path)

        # Populate sample courses in catalog
        sample_courses = [
            {
                "course_code": "CSE 30",
                "section": "01",
                "title": "Programming Abstractions in Python",
                "credits": 5,
                "ge": "MF",
                "days": "M,W,F",
                "start_time": "13:20",
                "end_time": "14:25",
                "room": "Classroom Unit 002",
                "instructor": "Alfvén, H.",
                "section_type": "LECTURE",
                "status": "Open",
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
                "section_type": "DISCUSSION",
                "status": "Open",
            },
            {
                "course_code": "CSE 101",
                "section": "01",
                "title": "Introduction to Data Structures and Algorithms",
                "credits": 5,
                "ge": None,
                "days": "Tu,Th",
                "start_time": "10:00",
                "end_time": "11:45",
                "room": "Baskin Engr 152",
                "instructor": "Tantalo, P.",
                "section_type": "LECTURE",
                "status": "Open",
            },
        ]
        bulk_insert_courses(sample_courses, db_path=self.db_path)

        # Setup sample vector chunks in ChromaDB
        self.chroma_path = os.path.join(self.temp_dir.name, "chroma")
        self.collection = get_or_create_collection(
            name="test_composite_col", db_path=self.chroma_path, force_mock=True
        )
        sample_chunks = [
            {
                "id": "cs_core_101",
                "text": "Upper-Division Core Requirements: Students must complete Introduction to Data Structures and Algorithms (CSE 101).",
                "degree_title": "Computer Science B.S.",
                "concentration": "General",
                "section_heading": "Upper-Division Requirements",
                "url": "https://catalog.ucsc.edu/cs-bs",
                "chunk_index": 0,
            },
            {
                "id": "cs_dc_195",
                "text": "Course CSE 195 may be used either as an elective, or to satisfy the DC requirement, but not for both.",
                "degree_title": "Computer Science B.S.",
                "concentration": "General",
                "section_heading": "Disciplinary Communication",
                "url": "https://catalog.ucsc.edu/cs-bs",
                "chunk_index": 1,
            },
        ]
        add_degree_chunks(sample_chunks, collection=self.collection, force_mock=True)

        # Setup sample DAG
        set_active_dag({
            "CSE 101": {
                "root_group": {
                    "type": "AND",
                    "courses": [
                        {"type": "COURSE", "course": "CSE 13S"},
                        {"type": "COURSE", "course": "CSE 16"},
                    ],
                }
            },
            "CSE 13S": {
                "root_group": {
                    "type": "AND",
                    "courses": [
                        {"type": "COURSE", "course": "CSE 30"},
                        {"type": "COURSE", "course": "CSE 12"},
                    ],
                }
            },
        })

        # Set student context
        self.student = {
            "name": "Sammy Slug",
            "major": "Computer Science B.S.",
            "standing": "Junior",
        }
        self.preferences = {
            "majorRequirementsTaken": ["CSE 30", "CSE 12"],
            "targetCredits": 15,
        }
        set_tool_context(self.student, self.preferences, [])

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_component_query_what_sections_for_cse_30(self):
        # Patch default DB path temporarily in catalog_dao
        from agent import catalog_dao
        old_path = catalog_dao.DEFAULT_DB_PATH
        catalog_dao.DEFAULT_DB_PATH = self.db_path
        try:
            res = get_course_sections.invoke({"course_code": "CSE 30"})
            self.assertIn("Section 01 [LECTURE]", res)
            self.assertIn("Section 01A [DISCUSSION]", res)
            self.assertIn("Classroom Unit 002", res)
        finally:
            catalog_dao.DEFAULT_DB_PATH = old_path

    def test_component_query_what_time_is_cse_30_01(self):
        from agent import catalog_dao
        old_path = catalog_dao.DEFAULT_DB_PATH
        catalog_dao.DEFAULT_DB_PATH = self.db_path
        try:
            res = get_course_time.invoke({"course_code": "CSE 30", "section": "01"})
            self.assertIn("CSE 30 Section 01 meets M,W,F from 13:20 to 14:25", res)
        finally:
            catalog_dao.DEFAULT_DB_PATH = old_path

    def test_component_query_prereqs_for_cse_101(self):
        # Student has completed CSE 30 and CSE 12, but not CSE 13S and CSE 16
        res = check_course_prerequisites.invoke({"course_code": "CSE 101"})
        self.assertIn("Student is NOT eligible for CSE 101", res)

        # Check prerequisite for CSE 13S (student has completed CSE 30 and CSE 12)
        res_eligible = check_course_prerequisites.invoke({"course_code": "CSE 13S"})
        self.assertIn("Student IS eligible for CSE 13S", res_eligible)

    def test_composite_scenario_simulation(self):
        """
        Simulates: 'Do I need to take CSE 101 to graduate? If so which of its prereqs can I take this quarter?'
        Step 1: query_degree_requirements -> determines CSE 101 is required
        Step 2: check_course_prerequisites for CSE 101 -> missing CSE 13S
        Step 3: check_course_prerequisites for CSE 13S -> ELIGIBLE
        Step 4: get_course_sections for CSE 13S -> retrieves available offerings
        """
        # Step 1: Query degree requirements
        deg_res = self.collection.query(query_texts=["CSE 101 Data Structures upper-division requirement"], n_results=1)
        self.assertIn("CSE 101", deg_res["documents"][0][0])

        # Step 2: Check CSE 101 eligibility
        cse101_check = check_course_prerequisites.invoke({"course_code": "CSE 101"})
        self.assertIn("NOT eligible", cse101_check)

        # Step 3: Check CSE 13S eligibility
        cse13s_check = check_course_prerequisites.invoke({"course_code": "CSE 13S"})
        self.assertIn("IS eligible", cse13s_check)

    def test_inspection_tools_list_contains_all_new_tools(self):
        tools = get_inspection_tools()
        tool_names = [t.name for t in tools]
        expected_tools = [
            "query_degree_requirements",
            "get_course_details",
            "get_course_sections",
            "get_course_time",
            "check_course_prerequisites",
        ]
        for et in expected_tools:
            self.assertIn(et, tool_names, f"Expected tool {et} in get_inspection_tools()")


if __name__ == "__main__":
    unittest.main()
