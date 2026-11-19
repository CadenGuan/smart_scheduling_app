# Quickstart Guide: UCSC Academic Catalog, ChromaDB RAG & Prerequisite DAG

**Branch**: `003-catalog-scraping-rag`
**Created**: 2026-11-17
**Feature**: Sprint 3 Task 1 (`docs/tasks/sprint-3/1.md`)

This guide outlines how to set up dependencies, execute data ingestion pipelines, inspect data artifacts, and run the automated test suite.

---

## 1. Prerequisites & Dependencies

The agent service requires updated dependencies for web scraping, vector storage, and embeddings.

Ensure your virtual environment is active in `agent_service`:
```bash
cd agent_service
source .venv/bin/activate
pip install -r requirements.txt
```

Key dependencies included:
- `chromadb>=0.5.0`: Vector database for degree requirements.
- `sentence-transformers>=3.0.0`: Local embedding execution for `BAAI/bge-small-en-v1.5`.
- `beautifulsoup4>=4.12.0` & `lxml>=5.0.0`: HTML parsing for catalog and PISA web pages.
- `pytest-cov>=5.0.0`: Test coverage reporting (validates >= 80% coverage).

---

## 2. Running Data Ingestion Pipelines

### Step 1: Scrape & Vectorize Bachelor's Degrees
Run the degree ingestion command to crawl catalog programs and populate ChromaDB:
```bash
python manage.py ingest_degrees --limit 5
```
*Expected Output*:
```text
[*] Crawling bachelor's degree index...
[*] Found 68 degree links.
[*] Processing Computer Science B.S. (General concentration)...
[*] Chunked into 12 sections on .expand and headings.
[✓] Persisted vectors to agent_service/data/chroma_db/
```

### Step 2: Scrape PISA Courses & Populate SQLite Database
Run the PISA class scraper to fetch lectures, discussions, times, and prerequisites:
```bash
python manage.py ingest_pisa --term 2270 --subject CSE --max-pages 2
```
*Expected Output*:
```text
[*] Submitting PISA search for term 2270...
[*] Parsed 25 classes with regex meeting patterns.
[✓] Inserted courses into agent_service/data/academic_catalog.db with zero whitespace.
```

### Step 3: Parse Prerequisites into `course_dag.json`
Run the DAG generator to extract and structure prerequisite logic trees:
```bash
python manage.py parse_prereq_dag --use-offline-parser
```
*Expected Output*:
```text
[*] Extracting prerequisite clauses from academic_catalog.db...
[*] Parsing CSE 40 -> (MATH 19B OR MATH 20B) AND CSE 30
[✓] Generated agent_service/data/course_dag.json (52 courses mapped).
```

---

## 3. Validating Ingested Artifacts

### Inspect SQLite Academic Catalog
```bash
sqlite3 agent_service/data/academic_catalog.db "SELECT course_code, section, section_type, days, start_time, end_time FROM courses LIMIT 5;"
```

### Inspect Prerequisite Logic in `course_dag.json`
```bash
cat agent_service/data/course_dag.json | grep -A 15 '"CSE 40"'
```

---

## 4. Running the Test Suite (>= 80% Coverage)

Run the automated test suite with coverage enforcement:
```bash
pytest tests/ --cov=agent --cov-report=term-missing
```

Validation Checklist:
- [x] Database creation and constraint handling pass (including invalid SQL operations).
- [x] ChromaDB exact text retrieval passes (verifying CSE 195 DC/elective clause).
- [x] Recursive DAG eligibility testing passes across single, AND, and OR prerequisites.
- [x] Code coverage exceeds 80%.
