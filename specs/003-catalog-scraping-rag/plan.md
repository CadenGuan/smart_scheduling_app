# Implementation Plan: UCSC Academic Catalog, ChromaDB RAG & Prerequisite DAG

**Branch**: `003-catalog-scraping-rag` | **Date**: 2026-11-17 | **Spec**: [specs/003-catalog-scraping-rag/spec.md](spec.md)

**Input**: Feature specification from `specs/003-catalog-scraping-rag/spec.md` (Sprint 3 Task 1)

---

## Summary

Build an authentic academic catalog and degree requirements intelligence layer for the UCSC scheduling agent by:
1. Scraping bachelor's degree requirements from `catalog.ucsc.edu`, chunking on `.expand` containers and headings, and indexing into a persistent ChromaDB vector store with `BAAI/bge-small-en-v1.5` embeddings.
2. Scraping active course offerings and discussion sections from UCSC PISA, normalizing meeting patterns via regular expressions, and populating an isolated SQLite `academic_catalog.db` with zero leading/trailing whitespace.
3. Parsing raw prerequisite strings into a recursive JSON logic tree (`course_dag.json`) supporting nested `AND` and `OR` groups, evaluated by a recursive eligibility solver.
4. Exposing three distinct tool categories in `agent_service/agent/tools.py` (`query_degree_requirements`, `get_course_details` / `get_course_sections` / `get_course_time`, and `check_course_prerequisites`) and updating `prompt_builder.py` with strict grounding persona rules, while keeping `mock_agent.py` completely unchanged.
5. Providing a test suite in `agent_service/tests/` achieving >= 80% coverage using offline fixtures.

---

## Technical Context

**Language/Version**: Python 3.12 (in `agent_service/.venv`)
**Primary Dependencies**:
- `Django>=5.0,<6.0` (Microservice framework and management commands)
- `chromadb>=0.5.0` (Vector database for degree requirements)
- `sentence-transformers>=3.0.0` (Local embedding inference for `BAAI/bge-small-en-v1.5`)
- `beautifulsoup4>=4.12.0` & `lxml>=5.0.0` (HTML scraping and chunking)
- `langchain>=0.2.0`, `langchain-core>=0.2.0`, `langchain-google-genai>=1.0.0` (LLM tool integration)
- `networkx>=3.0` & `pydantic>=2.0` (Graph and DAG data structures)
- `pytest>=8.0.0` & `pytest-cov>=5.0.0` (Testing and coverage)
**Storage**:
- SQLite (`agent_service/data/academic_catalog.db`)
- ChromaDB persistent vector index (`agent_service/data/chroma_db/`)
- JSON files (`agent_service/data/course_dag.json`)
**Testing**: `pytest` with `pytest-cov` targeting >= 80% code coverage
**Target Platform**: macOS (Darwin arm64) & Linux container deployment
**Project Type**: Multi-tier web application (Python Django agent microservice + Node.js backend + React frontend)
**Constraints**:
- Isolated data storage: All scraped databases and DAG files must live in `agent_service/data/`; Node backend must NOT directly modify them.
- `mock_agent.py` must NOT be changed.
- Offline-deterministic test execution using HTML and DB fixtures.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Compliance Status | Analysis & Verification |
| :--- | :--- | :--- |
| **I. Library / Module Isolation** | PASS | Scrapers, catalog DAO, ChromaDB vector store, and DAG solver are organized as modular, self-contained Python units under `agent_service/agent/`. |
| **II. CLI / Command Protocol** | PASS | Ingestion and parsing operations are exposed via standard Django management commands (`ingest_degrees`, `ingest_pisa`, `parse_prereq_dag`) with rich options and text output. |
| **III. Test-First (TDD) & Coverage** | PASS | Test suite in `agent_service/tests/` verifies database creation, invalid queries, ChromaDB text matching, and DAG recursion with a hard requirement of >= 80% coverage. |
| **IV. Data Access Boundaries** | PASS | Catalog database (`academic_catalog.db`) and ChromaDB are located strictly inside `agent_service/data/`, inaccessible to direct mutation by Node backend. |
| **V. Determinism & Offline Safety** | PASS | Tests use pre-captured HTML fixtures and deterministic mock embedding fallbacks so tests do not rely on live internet during execution. |

---

## Project Structure

### Documentation (this feature)

```text
specs/003-catalog-scraping-rag/
├── spec.md              # Feature specification derived from sprint3/1.md
├── plan.md              # This implementation plan
├── research.md          # Technical decisions, rationale, and alternatives
├── data-model.md        # Schemas for SQLite courses, ChromaDB chunks, and DAG Pydantic trees
├── quickstart.md        # Quickstart setup and validation guide
├── contracts/           # Interface contracts
│   ├── agent-tools.md   # Agent tool signatures and JSON schemas
│   └── management-commands.md # Management command CLI options
```

### Source Code Layout

```text
agent_service/
├── agent/
│   ├── management/
│   │   └── commands/
│   │       ├── ingest_degrees.py      # Crawls & chunks bachelor's degrees, indexes ChromaDB
│   │       ├── ingest_pisa.py         # Crawls PISA classes & sections, populates SQLite DB
│   │       └── parse_prereq_dag.py    # Generates course_dag.json logic tree from DB
│   ├── catalog_dao.py                 # SQLite helper, queries, whitespace trimming & validation
│   ├── chroma_rag.py                  # ChromaDB client, BAAI/bge-small embedding & retrieval
│   ├── dag_solver.py                  # Recursive is_eligible evaluator and DAG solver
│   ├── tools.py                       # LangChain @tool definitions for agent integration
│   ├── mock_agent.py                  # UNCHANGED (offline mock agent)
│   └── agent.py                       # LangChain agent with tool binding
├── agent_api/
│   └── prompt_builder.py              # System prompt with degree-planning persona
├── data/
│   ├── academic_catalog.db            # SQLite course catalog database
│   ├── chroma_db/                     # Persistent ChromaDB vector database
│   └── course_dag.json                # Structured prerequisite DAG JSON
├── requirements.txt                   # Updated with chromadb, sentence-transformers, bs4, pytest-cov
└── tests/
    ├── fixtures/                      # HTML and mock JSON fixtures
    │   ├── pisa_results.html
    │   ├── pisa_detail.html
    │   └── bachelors_degrees.html
    ├── test_catalog_dao.py            # SQLite table creation, insertion, invalid operations
    ├── test_chroma_rag.py             # ChromaDB indexing & exact clause retrieval (CSE 195)
    ├── test_dag_solver.py             # Prerequisite logic trees & recursive eligibility
    └── test_agent_tools.py            # Agent tools execution & prompt builder tests
```

**Structure Decision**:
The entire implementation is localized within `agent_service/` to strictly uphold the requirement that catalog and prerequisite processing is isolated from the Node backend. Management commands handle batch ingestion, modular Python services (`catalog_dao.py`, `chroma_rag.py`, `dag_solver.py`) implement core logic, and `@tool` wrappers in `tools.py` wire them into the LangChain agent.

---

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| Dedicated SQLite `academic_catalog.db` | Strict isolation from Node backend and user auth tables | Storing in `data/app.db` violates the requirement that Node backend must not directly modify catalog data |
| Recursive Pydantic logic tree (`course_dag.json`) | Prerequisite rules contain complex nested boolean expressions (`A AND (B OR C)`) | Flat edge list cannot evaluate disjunctive (OR) branches |
| Local `BAAI/bge-small-en-v1.5` embeddings | Required by task specification for accurate vector RAG | Remote cloud embeddings cost money and violate the explicit model specification |
