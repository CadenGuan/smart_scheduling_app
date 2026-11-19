import os
import tempfile
import unittest
from pathlib import Path

from agent.chroma_rag import (
    MockEmbeddingFunction,
    add_degree_chunks,
    get_or_create_collection,
    query_degree_chunks,
)
from agent.degree_scraper import extract_degree_chunks_from_html

FIXTURE_PATH = os.path.join(Path(__file__).resolve().parent, "fixtures", "cs_bs.html")


class TestChromaRAG(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = self.temp_dir.name
        self.collection = get_or_create_collection(
            name="test_degree_requirements",
            db_path=self.db_path,
            force_mock=True,
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_mock_embedding_deterministic_vectors(self):
        emb_fn = MockEmbeddingFunction(dim=384)
        v1 = emb_fn("Computer Science B.S. degree requirements")
        v2 = emb_fn("Computer Science B.S. degree requirements")
        self.assertEqual(len(v1), 384)
        self.assertEqual(v1, v2)

    def test_chunking_on_expand_and_headings(self):
        if not os.path.exists(FIXTURE_PATH):
            self.skipTest(f"Fixture {FIXTURE_PATH} not found")

        with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
            html_content = f.read()

        chunks = extract_degree_chunks_from_html(
            html_content,
            degree_title="Computer Science B.S.",
            concentration="General",
            url="https://catalog.ucsc.edu/cs-bs",
        )

        self.assertGreater(len(chunks), 0)
        # Verify chunk structure
        for chunk in chunks:
            self.assertIn("id", chunk)
            self.assertIn("text", chunk)
            self.assertEqual(chunk["degree_title"], "Computer Science B.S.")
            self.assertEqual(chunk["concentration"], "General")
            self.assertTrue(len(chunk["section_heading"]) > 0)

    def test_cse_195_exact_clause_retrieval(self):
        """
        Acceptance Criteria from 1.md:
        Retrieved information matching. Specifically for the Chroma DB something such as
        'Course CSE 195 may be used either as an elective, or to satisfy the DC requirement, but not for both'
        should be explicitly referred to after the query.
        """
        test_chunks = [
            {
                "id": "chunk_lower_div",
                "text": "Lower-Division Requirements: Students must complete CSE 12, CSE 13S, CSE 16, CSE 30, and MATH 19A-B.",
                "degree_title": "Computer Science B.S.",
                "concentration": "General",
                "section_heading": "Lower-Division Requirements",
                "url": "https://catalog.ucsc.edu/cs-bs",
                "chunk_index": 0,
            },
            {
                "id": "chunk_cse_195_rule",
                "text": "Course CSE 195 may be used either as an elective, or to satisfy the DC requirement, but not for both.",
                "degree_title": "Computer Science B.S.",
                "concentration": "General",
                "section_heading": "Disciplinary Communication (DC) Requirement",
                "url": "https://catalog.ucsc.edu/cs-bs",
                "chunk_index": 1,
            },
            {
                "id": "chunk_bio_concentration",
                "text": "Computational Biology Concentration: BME 160 and BME 205 required.",
                "degree_title": "Computer Science B.S.",
                "concentration": "Computational Biology",
                "section_heading": "Concentrations",
                "url": "https://catalog.ucsc.edu/cs-bs-bio",
                "chunk_index": 2,
            },
        ]

        added = add_degree_chunks(
            test_chunks,
            collection=self.collection,
            db_path=self.db_path,
            force_mock=True,
        )
        self.assertEqual(added, 3)

        # Query targeting CSE 195 rule
        results = query_degree_chunks(
            query="Can CSE 195 be used as an elective and satisfy the DC requirement?",
            major="Computer Science B.S.",
            concentration="General",
            n_results=2,
            collection=self.collection,
            db_path=self.db_path,
            force_mock=True,
        )

        self.assertGreater(len(results), 0)
        found_target = any(
            "Course CSE 195 may be used either as an elective, or to satisfy the DC requirement, but not for both"
            in r["document"]
            for r in results
        )
        self.assertTrue(
            found_target,
            "Expected exact CSE 195 clause to be retrieved from ChromaDB",
        )

    def test_filter_by_concentration(self):
        test_chunks = [
            {
                "id": "c1",
                "text": "General Track: Take 4 Upper-Division Electives.",
                "degree_title": "Computer Science B.S.",
                "concentration": "General",
                "section_heading": "Electives",
                "url": "https://catalog.ucsc.edu/cs-bs",
                "chunk_index": 0,
            },
            {
                "id": "c2",
                "text": "Computational Biology Track: Take BME 160 and BME 110.",
                "degree_title": "Computer Science B.S.",
                "concentration": "Computational Biology",
                "section_heading": "Electives",
                "url": "https://catalog.ucsc.edu/cs-bs-bio",
                "chunk_index": 1,
            },
        ]
        add_degree_chunks(test_chunks, collection=self.collection, force_mock=True)

        results = query_degree_chunks(
            query="electives track",
            major="Computer Science B.S.",
            concentration="Computational Biology",
            n_results=2,
            collection=self.collection,
            force_mock=True,
        )
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["metadata"]["concentration"], "Computational Biology")


if __name__ == "__main__":
    unittest.main()
