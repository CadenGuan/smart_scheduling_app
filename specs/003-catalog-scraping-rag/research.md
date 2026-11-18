# Research & Technical Decisions: UCSC Catalog Scraping, Vector Indexing (ChromaDB), SQLite Catalog DB & Prerequisite DAG Solver

**Branch**: `003-catalog-scraping-rag`
**Created**: 2026-11-17
**Feature**: Sprint 3 Task 1 (`docs/tasks/sprint-3/1.md`)

---

## 1. Data Ingestion Architecture & Execution Strategy

### Decision
Implement the scraping, vectorization, and prerequisite parsing pipelines as standard Django management commands inside `agent_service/agent/management/commands/`:
- `python manage.py ingest_degrees`: Crawls bachelor's degree pages, chunks by `.expand` and headings, embeds with `BAAI/bge-small-en-v1.5`, and writes to `agent_service/data/chroma_db/`.
- `python manage.py ingest_pisa`: Submits search query `binds[:subject] = ""` to PISA, crawls class detail pages, normalizes times/days via regex, strips whitespace, and populates `agent_service/data/academic_catalog.db`.
- `python manage.py parse_prereq_dag`: Reads raw prerequisites from `academic_catalog.db`, extracts structured logic trees, and writes `agent_service/data/course_dag.json`.

### Rationale
- Enforces strict data access boundaries: All pipeline logic and artifacts reside entirely in `agent_service/`, ensuring the Node backend cannot bypass the agent to alter course or requirement records.
- Deterministic and testable: Management commands can be programmatically invoked and verified in unit tests via Django's `call_command`.
- Decoupled from request-response cycles: Crawling hundreds of catalog and class pages takes several minutes and must not block server startup or HTTP request workers.

### Alternatives Considered
- **On-demand / Startup Initialization**: Checking and scraping on Django server startup. Rejected because live crawling adds minutes of latency to container startup, fails when offline, and risks rate-limiting bans.
- **Standalone root scripts**: Placing scripts in `scripts/`. Rejected because scripts in root risk coupling to the Node workspace, whereas `agent_service/agent/management/commands/` natively inherits Django context and settings.

---

## 2. Course Database Schema & SQLite DAO

### Decision
Create a dedicated SQLite database at `agent_service/data/academic_catalog.db` containing a `courses` table and a dedicated DAO module (`agent_service/agent/catalog_dao.py`).
- **Table Schema**:
  ```sql
  CREATE TABLE courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT NOT NULL,
      section TEXT NOT NULL,
      title TEXT NOT NULL,
      credits INTEGER,
      ge TEXT,
      class_number TEXT,
      days TEXT,
      start_time TEXT,
      end_time TEXT,
      room TEXT,
      instructor TEXT,
      meeting_dates TEXT,
      raw_prereqs TEXT,
      section_type TEXT NOT NULL DEFAULT 'LECTURE',
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_courses_code ON courses(course_code);
  CREATE INDEX idx_courses_section ON courses(course_code, section);
  ```
- **Sanitization Rule**: Every string inserted has leading and trailing whitespace stripped (`.strip()`).
- **Discussion Sections**: Associated with lecture courses, having `section_type = 'DISCUSSION'`, matching meeting dates, with room and status populated, and non-applicable attributes stored as `None` or `'N/A'`.
- **Query DAO**: Exposes `get_course_details`, `get_course_sections`, `get_course_time`, and validates queries against SQL injection and invalid column/course requests.

### Rationale
- Fully satisfies Sprint 3 requirements: Separate SQLite database with explicit `section_type` column and zero whitespace.
- Isolated from Node backend: Located in `agent_service/data/` rather than root `data/app.db`.

### Alternatives Considered
- **Reusing `data/app.db`**: Adding a `courses` table to the Node backend's SQLite DB. Rejected because `1.md` mandates that the data produced via data processing scripts must be accessible only to the agent, and the Node backend should not cheat by directly modifying it.

---

## 3. Vector Database (ChromaDB) & Text Embedding Model

### Decision
Use `chromadb.PersistentClient(path="agent_service/data/chroma_db")` with `BAAI/bge-small-en-v1.5` embeddings via `sentence-transformers` (or `HuggingFaceEmbeddings`).
- **Collection Name**: `degree_requirements`
- **Metadata Fields**:
  - `degree_title` (e.g. `"Computer Science B.S."`)
  - `concentration` (e.g. `"General"`, `"Computational Biology"`, or `"None"`)
  - `section_heading` (e.g. `"Lower-Division Requirements"`, `"Disciplinary Communication (DC)"`)
  - `url` (source catalog URL)
  - `chunk_id`
- **Chunking Strategy**: Split catalog pages by `.expand` container classes and HTML headings (`h2`, `h3`, `h4`), followed by a 350-word sliding window with 50-word overlap for long requirement blocks.
- **Offline / Test Embedding Fallback**: A deterministic embedding function for tests that avoids heavy HuggingFace weight downloads during CI, while preserving cosine similarity ranking.

### Rationale
- `BAAI/bge-small-en-v1.5` is an efficient, high-performing 33M parameter embedding model running seamlessly on CPU (~130MB weight file).
- Rich metadata filtering enables scoped queries (e.g., filtering specifically by the student's declared degree and concentration).
- Chunking on `.expand` and section headers preserves the semantics of degree requirement groupings so policies like CSE 195 DC/elective constraints are not split across arbitrary character boundaries.

### Alternatives Considered
- **Character-based chunking**: Chunking purely by 500 characters. Rejected because it slices requirement sentences and lists mid-word or mid-table, destroying prerequisite semantic context.
- **In-Memory Ephemeral ChromaDB**: Rejected because requirements would need to be re-embedded on every service launch.

---

## 4. Prerequisite DAG Representation & Recursive Solver

### Decision
Adopt the recursive Pydantic tree structure established in the mock project (`CourseOption`, `OrGroup`, `AndGroup`, `Prerequisite`) and store the parsed DAG in `agent_service/data/course_dag.json`.
- **JSON Structure**:
  ```json
  {
    "CSE 40": {
      "root_group": {
        "type": "AND",
        "courses": [
          {
            "type": "OR",
            "options": [
              {"type": "COURSE", "course": "MATH 19B"},
              {"type": "COURSE", "course": "MATH 20B"}
            ]
          },
          {
            "type": "COURSE",
            "course": "CSE 30"
          }
        ]
      }
    }
  }
  ```
- **Parsing Engine**:
  - Primary: LangChain with structured output using Gemini (`ChatGoogleGenerativeAI(model="gemini-2.5-flash")`).
  - Fallback / Offline: Deterministic rule/regex parser that breaks semicolon and "and"/"or" clauses into the matching Pydantic tree for test environments.
- **Eligibility Evaluator**:
  - Recursive `is_eligible(node, completed_courses)` function that evaluates boolean satisfiability across nested `AND` and `OR` groups.

### Rationale
- Accommodates complex prerequisite structures: Pure directed graphs cannot represent "Course A requires (B OR C) AND (D OR E)". The recursive tree model captures the exact logic of UCSC catalog prerequisites.
- Matches proven implementation in the mock project, ensuring reliability and zero ambiguity.

### Alternatives Considered
- **Flat NetworkX DAG only**: While NetworkX handles topological sorting well, it cannot natively represent disjunctive (OR) prerequisite requirements. Using the nested JSON DAG for boolean satisfiability combined with NetworkX for chain length provides the best of both worlds.

---

## 5. Agent Tools & System Prompt Integration

### Decision
1. **Tool Definitions in `agent_service/agent/tools.py`**:
   - `query_degree_requirements(query: str, major: str = "", concentration: str = "") -> str`: Embeds query, performs vector search against ChromaDB `degree_requirements` collection, returns top chunks.
   - `get_course_details(course_code: str, section: str = "") -> str`: Reads all attributes from `academic_catalog.db`.
   - `get_course_sections(course_code: str) -> str`: Returns all active lecture and discussion sections for a course.
   - `get_course_time(course_code: str, section: str = "01") -> str`: Returns days and time for a section.
   - `check_course_prerequisites(course_code: str, completed_courses: Optional[List[str]] = None) -> str`: Uses `course_dag.json` and recursive eligibility logic to check if a student can enroll.
2. **System Prompt in `agent_service/agent_api/prompt_builder.py`**:
   Embed the strict degree planning persona and grounding instructions:
   > "You are a university degree-planning assistant.
   > Use the degree requirements retrieval tool to determine which courses are required for a student's degree.
   > Use the course database to retrieve accurate course details.
   > Use the prerequisite tools to determine prerequisite dependencies.
   > Compare prerequisites against the student’s completed courses.
   > Synthesize information from all tool results into a clear, accurate answer.
   > Never assume a course is required unless supported by degree requirements retrieved from the knowledge base.
   > Never assume a prerequisite is completed unless it appears in the student's completed courses."
3. **Mock Agent Guard**:
   `agent_service/agent/mock_agent.py` is left **completely untouched** per user instructions.

---

## 6. Test Suite & Code Coverage Strategy (>= 80%)

### Decision
Implement comprehensive pytest test suites in `agent_service/tests/`:
- `test_catalog_dao.py`: Tests database creation, valid insertions, whitespace stripping, and invalid queries/operations.
- `test_chroma_rag.py`: Tests document chunking, indexing, and exact text retrieval (verifying CSE 195 DC/elective clause).
- `test_dag_solver.py`: Tests recursive eligibility evaluation on single courses, AND groups, and OR options with various student completion sets.
- `test_agent_tools.py`: Tests execution of all new `@tool` endpoints and prompt builder generation.
- **Fixtures**: Use static HTML fixtures (`ucsc_bs_page.html`, `pisa_results.html`) and in-memory/temp directories for SQLite and ChromaDB to ensure 100% offline reproducibility and >= 80% coverage.
