# Management Commands Contract

**Branch**: `003-catalog-scraping-rag`
**Created**: 2026-11-17
**Feature**: Sprint 3 Task 1 (`docs/tasks/sprint-3/1.md`)

This document outlines the command-line interfaces for the isolated data ingestion and parsing management commands in `agent_service/`.

---

## 1. `ingest_degrees`

Crawls UCSC bachelor's degree pages, chunks by `.expand` containers and headings, embeds with `BAAI/bge-small-en-v1.5`, and writes to ChromaDB.

### Syntax
```bash
python manage.py ingest_degrees [--url <INDEX_URL>] [--limit <NUM_DEGREES>] [--db-path <CHROMA_DIR>]
```

### Options
- `--url`: Bachelor's degrees index URL (default: `https://catalog.ucsc.edu/en/current/general-catalog/academic-programs/bachelors-degrees`).
- `--limit`: Limit number of degrees scraped (default: all).
- `--db-path`: ChromaDB storage directory (default: `agent_service/data/chroma_db`).

### Output
Persists vector collection `degree_requirements` in `agent_service/data/chroma_db/`.

---

## 2. `ingest_pisa`

Submits POST request to UCSC PISA with `binds[:subject] = ""` for all subjects, crawls course and discussion detail pages, normalizes times/dates, strips whitespace, and inserts records into SQLite.

### Syntax
```bash
python manage.py ingest_pisa [--term <TERM_CODE>] [--subject <DEPT_CODE>] [--max-pages <NUM_PAGES>] [--db-path <SQLITE_PATH>]
```

### Options
- `--term`: 4-digit PISA term code (default: active term e.g. `2270` for Winter 2027).
- `--subject`: Optional subject filter (e.g. `CSE`, default: empty for all subjects).
- `--max-pages`: Pagination cutoff for scoped testing.
- `--db-path`: SQLite file path (default: `agent_service/data/academic_catalog.db`).

### Output
Creates and populates `courses` table in `agent_service/data/academic_catalog.db`.

---

## 3. `parse_prereq_dag`

Extracts unique course prerequisite texts from `academic_catalog.db`, parses them into nested boolean logic trees using structured output, and saves the output to JSON.

### Syntax
```bash
python manage.py parse_prereq_dag [--db-path <SQLITE_PATH>] [--output <JSON_PATH>] [--use-offline-parser]
```

### Options
- `--db-path`: Source SQLite path (default: `agent_service/data/academic_catalog.db`).
- `--output`: Output JSON path (default: `agent_service/data/course_dag.json`).
- `--use-offline-parser`: Flags parser to use rule-based regex parsing instead of Gemini API calls.

### Output
Generates `agent_service/data/course_dag.json`.
