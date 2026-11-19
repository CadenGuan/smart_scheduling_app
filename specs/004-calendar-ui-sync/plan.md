# Implementation Plan: Interactive Calendar UI & Sync Engine

**Branch**: `task/2` | **Date**: 2026-11-18 | **Spec**: [specs/004-calendar-ui-sync/spec.md](file:///Users/mac/Documents/Caden/UCSC/Fall2026/CSE115/smart-scheduling/smart_scheduling_app/specs/004-calendar-ui-sync/spec.md)

**Input**: Feature specification from `specs/004-calendar-ui-sync/spec.md` derived from Sprint 3 Task 2 (`docs/tasks/sprint-3/2.md`).

---

## Summary

Sprint 3 Task 2 transitions the application from a placeholder timetable into a production-grade, local-first interactive scheduling calendar powered by FullCalendar and an asynchronous Google Calendar sync engine. 

Key technical deliverables:
1. **Interactive FullCalendar UI**: Integrated `@fullcalendar/react` and `@fullcalendar/timegrid` in `client/` in read-only mode (`editable={false}`), displaying recurring weekly classes (Mon-Fri, 8 AM - 8 PM), with gray distinction for imported corporate events.
2. **Relational Database Migration**: Added `user_settings` for sync toggles and migrated to `user_schedule` tracking `sync_status` (`pending`, `synced`, `failed`), `is_imported`, and `google_event_id`, enforcing multi-user foreign key integrity.
3. **Agent Mutation Tools & Google MCP Isolation**: Added `create_class_event` and `delete_class_event` tools in Django calling Node's CRUD API via Bearer session token, while strictly constraining Google MCP tools to read-only mode (`list_events`, `find_free_time`).
4. **Resilient Sync Engine (Node -> Django -> Google)**: Dual-triggered sync pipeline that batches pending non-imported events, invokes Django's `/api/sync/push` with the user's OAuth access token, and automatically executes token refresh recovery if a Google 401 is encountered.
5. **Data Isolation**: Strictly preserved data isolation between Node SQLite and Django catalog SQLite.

---

## Technical Context

**Language/Version**:
- Client: TypeScript 5.4, React 18.3, Vite 5.3
- Server: Node.js 22/24, TypeScript 5.4, Express, `node:sqlite`
- Agent Service: Python 3.12, Django 5.x, LangChain / LangGraph, Pydantic v2

**Primary Dependencies**:
- Client: `@fullcalendar/react`, `@fullcalendar/core`, `@fullcalendar/timegrid`, `lucide-react`, `zustand`, `tailwindcss`
- Server: `express`, `uuid`, `dotenv`, `zod`, `shared`
- Agent Service: `chromadb`, `sentence-transformers`, `beautifulsoup4`, `requests`, `google-api-python-client`

**Storage**:
- Node Backend: SQLite (`data/app.db`) for `users`, `user_settings`, `user_schedule`, `oauth_tokens`, `sessions`.
- Agent Service: SQLite (`agent_service/data/academic_catalog.db`) & ChromaDB (`agent_service/data/chroma_db/`).

**Testing**:
- Client: Vitest + React Testing Library
- Server: Vitest (`server/tests/`)
- Agent Service: Pytest + `pytest-cov` (enforcing >= 80% coverage)

**Target Platform**: Web application (Desktop/Mobile responsive)

**Project Type**: Multi-tier web application (React SPA + Express Node API + Django AI Agent Service)

**Performance Goals**:
- FullCalendar render time < 100ms for standard 15-credit course schedules.
- Local event insertion latency < 50ms (local-first write).
- Asynchronous sync push execution without blocking user interactions.

**Constraints**:
- Events created locally first in SQLite before any external push.
- Django agent service never writes or reads Node's SQLite database directly.
- The user cannot create or delete an event directly in the calendar UI; all mutations flow through the AI agent.

---

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design.*

- [x] **Local-First Architecture**: Events written to `user_schedule` in local SQLite before external Google Calendar push.
- [x] **Relational Integrity**: Enforced foreign key constraints between `users` and `user_schedule` / `user_settings`.
- [x] **Agent Security & Principle of Least Privilege**: Agent strictly forbidden from calling Google MCP write operations; agent mutations restricted to local Node API endpoints.
- [x] **Test-First & Coverage Compliance**: Unit and integration test suites covering FullCalendar mapping, CRUD routes, sync engine recovery, and agent tools.

---

## Project Structure

### Documentation (this feature)

```text
specs/004-calendar-ui-sync/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Technical analysis & design decisions
├── data-model.md        # Relational schema & DTO definitions
├── quickstart.md        # Setup & validation guide
├── contracts/           # API and tool interfaces
│   ├── user-schedule-crud.md
│   ├── sync-engine.md
│   └── agent-tools.md
└── tasks.md             # Implementation tasks (/speckit-tasks output)
```

### Source Code Layout

```text
client/
├── package.json                                 # Added @fullcalendar dependencies
└── src/
    ├── components/
    │   └── dashboard/
    │       ├── CalendarPreview.tsx              # Replaced placeholder with <FullCalendar>
    │       └── SyncStatusBadge.tsx              # Renders pending/synced/failed status
    └── services/
        └── scheduleService.ts                   # Client API calls to /api/user_schedule

server/
├── src/
│   ├── db/
│   │   ├── schema.sql                           # user_settings & user_schedule DDL
│   │   └── queries/
│   │       ├── scheduleQueries.ts               # user_schedule CRUD queries
│   │       └── settingsQueries.ts               # user_settings queries
│   ├── routes/
│   │   ├── schedule.routes.ts                   # /api/user_schedule CRUD endpoints
│   │   └── sync.routes.ts                       # /api/sync/run endpoint
│   └── services/
│       └── syncEngine.service.ts                # Asynchronous sync engine with token refresh
└── tests/
    ├── schedule.routes.test.ts                  # Node CRUD tests
    └── syncEngine.test.ts                       # Sync Engine & recovery tests

agent_service/
├── agent/
│   ├── tools.py                                 # Added create_class_event & delete_class_event
│   └── agent.py                                 # Read-only Google MCP bindings
├── agent_api/
│   ├── views.py                                 # Added /api/sync/push/ endpoint
│   └── urls.py                                  # Route registration for sync push
└── tests/
    ├── test_schedule_tools.py                   # Pytest suite for new agent tools
    └── test_sync_push.py                        # Pytest suite for Google push endpoint

shared/
└── src/
    └── schemas/
        └── schedule.schema.ts                   # Shared TypeScript models and Zod schemas
```

---

## Implementation Phases

### Phase 0: Research (Completed)
- Addressed in `specs/004-calendar-ui-sync/research.md`:
  - FullCalendar React 18 configuration with recurring weekly classes.
  - Relational schema migration and table constraints.
  - Asynchronous sync engine flow, error catching, and refresh token recovery.
  - Agent tool constraints and Google MCP read-only policy.

### Phase 1: Design Artifacts (Completed)
- Data Model: `specs/004-calendar-ui-sync/data-model.md`
- Contracts:
  - `specs/004-calendar-ui-sync/contracts/user-schedule-crud.md`
  - `specs/004-calendar-ui-sync/contracts/sync-engine.md`
  - `specs/004-calendar-ui-sync/contracts/agent-tools.md`
- Quickstart Guide: `specs/004-calendar-ui-sync/quickstart.md`

### Phase 2: Tasks Breakdown
- Run `/speckit-tasks` to generate dependency-ordered task breakdown in `tasks.md`.
