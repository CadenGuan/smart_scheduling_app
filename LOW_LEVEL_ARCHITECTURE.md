# Low-Level Architecture Specification

## 1. Design Decisions & Open-Source Offloading

Below is the complete inventory of original architectural design decisions from Sprint 1. Decisions replaced with open-source GitHub libraries/APIs are marked with strikethrough, with the adopted replacement and rationale indented underneath.

### Frontend Architecture
* **Core Framework:** React 18 + Vite + Tailwind CSS (Kept)
* **Global State Management:** Zustand for client-side state store (Kept)
* **Form Handling:** React Hook Form (Kept)
* **Authentication UI:**
  * ~~Custom scratch LoginPage and SignupPage with bespoke validation~~
    * Replaced with: [`shadcn/ui`](https://github.com/shadcn-ui/ui) Form primitives + [`zod`](https://github.com/colinhacks/zod) schema validation
* **Route Protection:** `AuthGuard` wrapper component redirecting unauthenticated sessions (Kept)
* **Onboarding Questionnaire UI:**
  * ~~Custom multi-step questionnaire stepper built from scratch~~
    * Replaced with: [`shadcn/ui`](https://github.com/shadcn-ui/ui) Stepper / `@stepperize/react` + `react-hook-form`
* **Calendar Timetable Preview:**
  * ~~Custom React calendar preview grid rendering placeholder events~~
    * Replaced with: [`@fullcalendar/react`](https://github.com/fullcalendar/fullcalendar) (`timeGridWeek`, `dayGridMonth`, `interaction` drag-and-drop)
* **Calendar Export:**
  * ~~Custom scratch string formatter for .ics generation~~
    * Replaced with: Python [`icalendar`](https://github.com/collective/icalendar) library (RFC 5545 compliant + `VALARM` 15-min alerts)
* **Interactive UI Tutorial:**
  * ~~Custom overlay modal components from scratch~~
    * Replaced with: [`driver.js`](https://github.com/kamranahmedse/driver.js) / Radix UI Popover walkthrough

### Backend Architecture
* **Backend Framework:** Python 3.11 + FastAPI (Kept)
* **Data Validation:** Pydantic v2 schemas for all requests and responses (Kept)
* **Password Hashing:**
  * ~~Custom password hashing module in core/auth/passwords.py using raw argon2/bcrypt~~
    * Replaced with: [`fastapi-users`](https://github.com/fastapi-users/fastapi-users) built-in `argon2-cffi` hasher
* **Session Token Management:**
  * ~~Custom token manager in core/auth/tokens.py for JWT / opaque tokens~~
    * Replaced with: [`fastapi-users`](https://github.com/fastapi-users/fastapi-users) `JWTStrategy` & `BearerTransport`
* **Authentication Endpoints:**
  * ~~Custom endpoints in api/auth.py (/register, /login, /logout)~~
    * Replaced with: [`fastapi-users`](https://github.com/fastapi-users/fastapi-users) router (`get_auth_router`, `get_register_router`)
* **Database Engine:** SQLite in WAL (Write-Ahead Logging) mode (Kept)
* **ORM & Database Queries:**
  * ~~Raw SQLAlchemy 2.0 models with bespoke query functions in data/db/queries.py~~
    * Replaced with: [`sqlmodel`](https://github.com/tiangolo/sqlmodel) (unified SQLAlchemy 2.0 + Pydantic type-safe ORM)
* **User File Management:**
  * ~~Bespoke file indexer in data/storage/user_files.py and users.json~~
    * Replaced with: Standard SQLite connection manager targeting `~/.smart_scheduler/<user_id>.db`
* **Database Schema Migrations:** Alembic migration scripts (Kept)

### Intelligence, Scraping & Evaluation
* **Course Catalog Scraping:**
  * ~~Custom scraper server from scratch using Selenium/BeautifulSoup~~
    * Replaced with: [`crawl4ai`](https://github.com/unclecode/crawl4ai) (async headless crawler converting UCSC pages to Markdown)
* **Agent Scheduling Engine:**
  * ~~Hand-rolled LLM prompting loops and bespoke retry controllers~~
    * Replaced with: [`langgraph`](https://github.com/langchain-ai/langgraph) StateGraph with SQLite checkpointing
* **Prerequisite Pathfinding:**
  * ~~LLM-prompt-based prerequisite course order guessing~~
    * Replaced with: [`networkx`](https://github.com/networkx/networkx) Directed Acyclic Graph (DAG) shortest-path engine (+ [`@xyflow/react`](https://github.com/xyflow/xyflow) for UI rendering)
* **Workload & Capacity Flagging:**
  * ~~Procedural if/else scripts for schedule validation~~
    * Replaced with: Declarative [`pydantic`](https://github.com/pydantic/pydantic) validator pipeline & constraint checker
* **Testing Framework:** pytest (backend) and Vitest (frontend) (Kept)

---

## 2. Low-Level Component Architecture Flowchart

```text
+-----------------------------------------------------------------------------------------+
| [C5. Tutorial Walkthrough] driver.js / Radix Popover (Self-Contained UI Component)      |
+-----------------------------------------------------------------------------------------+

+=========================================================================================+
| LAYER 1: PRESENTATION & INTERACTION (React 18 + Vite + Tailwind)                        |
+=========================================================================================+
|                                                                                         |
|                       +-----------------------------------+                             |
|                       | C1. Auth UI (shadcn/ui + zustand) |                             |
|                       +-----------------+-----------------+                             |
|                                         |                                               |
|               +-------------------------+-------------------------+                     |
|               | (new user)                                        | (returning user)    |
|               v                                                   v                     |
|  +-----------------------------+             +---------------------------------------+  |
|  | C2. Questionnaire Wizard    |             | C4. Calendar UI (@fullcalendar/react) |  |
|  | (react-hook-form + zod)     |             +----+--------------------+-------------+  |
|  +--------------+--------------+                  | (drag/drop swap)   ^ (active sched)|  |
|                 | (validated intake)              v                    |               |  |
|                 v                            +----+--------------------+--+            |  |
|  +-----------------------------+             | C9. Prereq Tree Graph UI   |            |  |
|  | C7. User Preferences Form   |             | (@xyflow/react Flow Chart) |            |  |
|  | (shadcn/ui Sheet/Dialog)    |             +----------------------------+            |  |
|  +--------------+--------------+                  | (manual edit event)                |  |
|                 | (preference delta)              |                                    |  |
+=================|=================================|====================================|==+
| LAYER 2: APPLICATION & ORCHESTRATION (FastAPI)    |                                    |  |
+=================|=================================|====================================|==+
|                 |                                 |                                    |  |
|                 |             +-------------------v--------------------+               |  |
|                 +------------>| C8. LangGraph Context Builder Node     |<--------------+  |
|                               | (Reconstructs agent context from state)| (re-plan trigger)|
|                               +-------------------+--------------------+                  |
|                                                   | (rebuilt context)                     |
|                                                   v                                       |
|                               +----------------------------------------+                  |
|                               | C3. crawl4ai (Async UCSC Scraper)      |                  |
|                               +-------------------+--------------------+                  |
|                                                   | (scraped markdown catalog)            |
|                                                   v                                       |
|                               +----------------------------------------+                  |
|                               | C3. LangGraph Schedule Generator Node  |                  |
|                               | (LLM synthesis + networkx DAG solver)  |                  |
|                               +-------------------+--------------------+                  |
|                                                   | (candidate schedule)                  |
|                                                   v                                       |
|                               +----------------------------------------+                  |
|                               | C10. pydantic Capacity Validator Node  |                  |
|                               | (Audits unit caps, overlaps, fatigue)  |                  |
|                               +---------+--------------------+---------+                  |
|                                         |                    |                            |
|                     (violations detected|                    | (approved schedule)        |
|                      re-inject to state)|                    |                            |
|                                         v                    v                            |
+=========================================|====================|============================+
| LAYER 3: PERSISTENCE & UTILITIES        |                    |                            |
+=========================================|====================|============================+
|                                         |  +-----------------v----------------+           |
|                                         |  | C4. icalendar Exporter Module    |           |
|                                         |  | (RFC 5545 generator with VALARM)|           |
|                                         |  +-----------------+----------------+           |
|                                         |                    |                            |
|                                         |  +-----------------v----------------+           |
|                                         +->| C6. sqlmodel SQLite Store (WAL)  +-----------+
|                                            | (~/.smart_scheduler/<user_id>.db)|
|                                            +----------------------------------+
+-------------------------------------------------------------------------------------------+
```
