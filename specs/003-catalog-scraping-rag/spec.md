# Feature Specification: UCSC Catalog Scraping, Vector Indexing (ChromaDB), SQLite Catalog DB & Prerequisite DAG Solver

**Feature Branch**: `003-catalog-scraping-rag`
**Created**: 2026-11-17
**Status**: Ready
**Input**: Sprint 3 Task 1 (`docs/tasks/sprint-3/1.md`)

## Problem Statement

The scheduling agent currently relies on hardcoded course dictionaries and static DAG structures. To provide authentic, up-to-date university degree advising for UCSC students, the agent requires:
1. Live-scraped bachelor's degree requirements indexed in a vector store for semantic retrieval of graduation rules, concentrations, and complex elective/substitution policies.
2. An isolated, queryable SQLite `academic_catalog.db` populated from PISA (UCSC Schedule of Classes) with lecture and discussion section timings, rooms, instructors, and raw prerequisites.
3. A prerequisite DAG representation supporting nested boolean logic (AND/OR groups) derived from course prerequisites to accurately evaluate student course eligibility.
4. Agent tools enabling both direct attribute lookups, prerequisite verification, and vector-backed knowledge synthesis.
5. Strict isolation ensuring data processing scripts and databases are accessible only to the agent service and not directly modified by the Node backend.

---

## User Scenarios & Testing

### User Story 1 - Degree Requirements Retrieval via ChromaDB (Priority: P1)

As a UCSC student, I want to ask Sammy the Slug about my degree requirements (e.g. "What courses do I need to graduate?", "Can CSE 195 be used for DC and an elective?"), so that I receive accurate guidance grounded in official university catalog text.

**Why this priority**: Core foundation of degree planning; students cannot plan graduation without official major requirements and substitution rules.
**Independent Test**: Querying ChromaDB with "Can CSE 195 satisfy both DC and elective requirements?" retrieves the chunk stating: *"Course CSE 195 may be used either as an elective, or to satisfy the DC requirement, but not for both"*.

**Acceptance Scenarios**:
1. **Given** bachelor's degree pages scraped and chunked on `.expand` containers and headings, **When** chunks are embedded with `BAAI/bge-small-en-v1.5` into ChromaDB, **Then** semantic similarity queries return relevant degree sections with major/concentration metadata.
2. **Given** a degree with distinct concentrations (e.g., Computer Science B.S.), **When** chunks are indexed, **Then** each concentration is tagged as a distinct entry in ChromaDB metadata.

---

### User Story 2 - Course Schedule, Section, and Time Lookups from SQLite (Priority: P1)

As a student, I want to ask about specific class meeting times and sections for an upcoming quarter (e.g. "What sections are there for CSE 30 this quarter?", "What time is CSE 30 01?"), so that I can evaluate lecture and discussion compatibility.

**Why this priority**: Essential for timetable construction; students cannot build conflict-free weekly schedules without real section times and discussion links.
**Independent Test**: Can query `academic_catalog.db` for `CSE 30` and receive all lecture sections and associated discussion sections with parsed days, start times, and end times.

**Acceptance Scenarios**:
1. **Given** classes scraped from PISA with `binds[:subject] = ""`, **When** inserted into `academic_catalog.db`, **Then** days and 24-hour start/end times are regex-parsed, with preceding and trailing whitespace stripped from every column.
2. **Given** discussion sections in PISA, **When** stored in the database, **Then** they have `section_type = 'DISCUSSION'`, matching meeting dates of the parent lecture, with day, time, status, and room populated.

---

### User Story 3 - Prerequisite Verification & DAG Eligibility (Priority: P1)

As a student, I want to ask what prerequisites are required for a target course (e.g. "What are the prereqs for CSE 40?", "Am I eligible to take CSE 101?"), so that I do not enroll in classes I am not qualified for.

**Why this priority**: Academic progression depends on strictly respecting prerequisites.
**Independent Test**: Given a student with `MATH 19B` and `CSE 30`, evaluating eligibility for `CSE 40` returns `ELIGIBLE`. Given a student with only `MATH 19B`, it returns `NOT_ELIGIBLE` with missing prerequisite options.

**Acceptance Scenarios**:
1. **Given** raw prerequisite text in `academic_catalog.db`, **When** parsed into `course_dag.json`, **Then** prerequisites are structured into nested Pydantic logic trees (`AndGroup`, `OrGroup`, `CourseOption`).
2. **Given** a student's completed courses, **When** `check_course_prerequisites` is called, **Then** the recursive evaluator returns boolean eligibility and missing course groups.

---

### User Story 4 - Composite Academic Planning Query (Priority: P2)

As a student, I want to ask multi-step composite questions (e.g. "Do I need to take CSE 101 to graduate? If so which of its prereqs can I take this quarter?"), so that the agent combines degree requirements, prerequisite trees, and current class availability in a single answer.

**Why this priority**: Real student interactions are rarely single-attribute lookups; composite queries prove end-to-end tool synthesis.
**Independent Test**: The agent executes `query_degree_requirements`, `check_course_prerequisites`, and `get_course_sections` in sequence and generates a synthesized response.

**Acceptance Scenarios**:
1. **Given** a composite prompt, **When** the agent runs with tool calling, **Then** it invokes degree retrieval, prerequisite checking, and catalog lookup tools before delivering the synthesized response.

---

### User Story 5 - Isolated Ingestion Commands (Priority: P3)

As a developer or system operator, I want to run dedicated Django management commands (`python manage.py ingest_degrees`, `python manage.py ingest_pisa`, `python manage.py parse_prereq_dag`), so that the data pipeline runs deterministically and offline without allowing the Node backend to alter catalog data.

**Why this priority**: Enforces data isolation and reproducibility across environments.
**Independent Test**: Running each management command generates the expected data files in `agent_service/data/`.

---

## Edge Cases

1. **Course without Prerequisites**: Handled as an empty `AND` group (`{"type": "AND", "courses": []}`) so `is_eligible` returns `True` immediately.
2. **Complex Semicolon Prerequisite Clauses**: Handled according to semicolon operator precedence ("A; and B or C" -> `A AND (B OR C)`).
3. **PISA Courses without Discussion**: Stored with `section_type = 'LECTURE'`, discussion fields set to `None`/`N/A`.
4. **Invalid Database Operations**: Querying non-existent courses or executing malformed queries returns structured error messages rather than throwing unhandled exceptions.
5. **Offline/Test Environments**: Tests use local HTML fixtures, in-memory SQLite, and deterministic test ChromaDB embeddings so test suites run fast without network access.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a degree scraping and chunking pipeline targeting `https://catalog.ucsc.edu/.../bachelors-degrees` chunking on `.expand` and headings.
- **FR-002**: System MUST vectorize degree chunks using `BAAI/bge-small-en-v1.5` embeddings and persist them in ChromaDB at `agent_service/data/chroma_db/`.
- **FR-003**: System MUST provide a PISA class scraper for `https://pisa.ucsc.edu/class_search/` with `binds[:subject] = ""` for all subjects.
- **FR-004**: System MUST store scraped courses in `agent_service/data/academic_catalog.db` with columns: `course_code`, `section`, `title`, `credits`, `ge`, `class_number`, `days`, `start_time`, `end_time`, `room`, `instructor`, `meeting_dates`, `raw_prereqs`, `section_type`, `status`.
- **FR-005**: System MUST strip all leading and trailing whitespace from every database column upon insertion.
- **FR-006**: System MUST parse class meeting days and times into normalized days list and 24-hour time strings (`HH:MM`).
- **FR-007**: System MUST parse raw prerequisites into a nested JSON DAG (`agent_service/data/course_dag.json`) matching the recursive Pydantic schema (`CourseOption`, `OrGroup`, `AndGroup`).
- **FR-008**: System MUST implement recursive DAG eligibility verification (`is_eligible(node, completed_courses)`).
- **FR-009**: System MUST provide three agent inspection tool categories in `agent_service/agent/tools.py`:
  - Vector query tool: `query_degree_requirements`
  - Catalog get tools: `get_course_details`, `get_course_sections`, `get_course_time`
  - Recursive DAG tool: `check_course_prerequisites`
- **FR-010**: System MUST incorporate the required degree-planning persona and strict grounding constraints into `prompt_builder.py`.
- **FR-011**: System MUST leave `agent_service/agent/mock_agent.py` completely unchanged.
- **FR-012**: System MUST provide a comprehensive automated test suite in `agent_service/tests/` achieving at least 80% code coverage across all new modules.

---

## Success Criteria

- **SC-001**: 100% of courses inserted in `academic_catalog.db` have zero leading/trailing whitespace.
- **SC-002**: ChromaDB semantic search returns the exact CSE 195 constraint text when queried regarding elective and DC dual-fulfillment.
- **SC-003**: Prerequisite DAG correctly resolves complex prerequisite logic trees including AND and OR branches.
- **SC-004**: Automated test suite achieves >= 80% code coverage on the database, DAG solver, scrapers, and tools.
- **SC-005**: All tests execute deterministically offline without network calls to UCSC servers during test execution.
