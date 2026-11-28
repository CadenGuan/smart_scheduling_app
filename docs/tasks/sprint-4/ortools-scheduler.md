---
id: ortools-scheduler
story: 1
assignee: Abeetzer
sprint: 4
estimate_hours: 5
---

# Deterministic Schedule Optimization with Google OR-Tools (CP-SAT)

## Description

Our current scheduling pipeline relies on LLM reasoning (live mode) and a greedy heuristic (preview/mock mode). Because LLMs are probabilistic and greedy heuristics evaluate courses one at a time, the system can propose overlapping sections, exceed credit caps, drop discussion sections, ignore prerequisite eligibility, or produce poor daily gaps.

This task introduces a deterministic **Google OR-Tools CP-SAT** optimization layer in `agent_service` so the LLM never performs scheduling math—wiring existing repo data (`academic_catalog.db`, `course_dag.json`, `UserPreferences`, `currentSchedule`) into a plug-and-play constraint solver verified end-to-end with **TDD** and **full-stack Playwright (CodeGen)**.

## Specs

The OR-Tools scheduling architecture is organized into two vertical slices:

1. **Slice 1 — Prerequisite Regex Guard & CP-SAT Solver (`agent_service/`)**:
   - **Dependency**: Add `ortools` to `agent_service/requirements.txt`.
   - **Regex DAG Guard (`agent_service/agent/prereq_parser.py`)**: Enforce a strict `^[A-Z]{2,5}\s+\d+[A-Z]?$` regex gate in `parse_prerequisite_text_rules()` so prose/descriptions are never inserted as `"COURSE"` nodes in `course_dag.json`. Re-ingest live PISA & degree data.
   - **CP-SAT Solver (`agent_service/agent/schedule_solver.py`)**:
     - Deduplicates catalog rows by `(course_code, section, section_type)`, skips `TBA` intervals, and treats `DISCUSSION` rows as `0` credits (while `LECTURE` rows default to `5` if null).
     - Converts all lectures, discussions, and `currentSchedule` busy blocks into weekday minute-intervals (`NewIntervalVar`) with `AddNoOverlap` per weekday.
     - Pairs each selected `LECTURE` with `1` matching `DISCUSSION` (`01*` prefix first, fallback to any discussion for that course).
     - Enforces `<= 1` course per unfulfilled GE category, `<= targetCredits` hard cap (soft `>= 12` unit preference), and `OnlyEnforceIf` gap-time bonuses for same-day consecutive sections matching `preferredGapMinutes`.
     - Returns `CalendarEventSchema`-compatible `proposedCourses` or `status: "INFEASIBLE"` with conflict diagnostics.
   - **HTTP Seam (`agent_service/agent_api/views.py`, `urls.py`)**: Expose `/api/agent/solve/` (additive, leaving `/api/agent/process/` intact).

2. **Slice 2 — Agent/Backend Wiring & Full-Stack Playwright E2E**:
   - **Agent & Backend Integration**: Register `solve_schedule` as a LangChain tool in `agent_service/agent/tools.py` & `agent.py`, and wire `server/src/services/calendar.service.ts` (`getPreview()`) to `/api/agent/solve/`.
   - **Full-Stack Playwright E2E (`playwright.config.ts`, `e2e/schedule-solver.spec.ts`)**: Update `webServer` to boot the full stack (`client` + `server` + `agent_service`) and verify the CodeGen-recorded user journey end-to-end.

## Requirements

1. **Deterministic Math**: All hard scheduling constraints (time overlaps, credit caps, GE limits, lecture/discussion pairing, and prerequisite eligibility) must be enforced by OR-Tools CP-SAT, never by LLM prompt reasoning.
2. **Regex DAG Safety**: `prereq_parser.py` must never emit non-course-code prose into `course_dag.json`; core CS courses must fall back to `build_ucsc_cs_dag()` when JSON entries are empty.
3. **Contract Preservation**: Solver output must conform to `CalendarEventSchema` so `client/` and `shared/` schemas remain untouched.
4. **TDD & Prefix Compliance**: Unit/acceptance tests must be written test-first at the `solve_schedule()` / `/api/agent/solve/` seam and full-stack Playwright seam, with all test names prefixed with `ortools-scheduler:`.
5. **Quality Gates**: All repo checks (`npm test`, `npm run test:agent`, `npm run test:e2e`, `npm run lint:all`, `npm run typecheck:all`) must pass cleanly.

## Acceptance criteria

- **AC1 (`ortools-scheduler: AC1`)**: Zero time conflicts — `solve_schedule()` deduplicates catalog rows, skips `TBA` intervals, and returns zero overlapping lecture, discussion, or `currentSchedule` busy-block intervals.
- **AC2 (`ortools-scheduler: AC2`)**: Prerequisite eligibility & core priority — `parse_prerequisite_text_rules()` only emits `COURSE` nodes matching `^[A-Z]{2,5}\s+\d+[A-Z]?$`; `solve_schedule()` excludes courses with unmet prerequisites and prioritizes core courses that unlock more downstream requirements.
- **AC3 (`ortools-scheduler: AC3`)**: Electives & extraneous courses — explicit user-requested electives receive core priority; undecided orientation answers score ChromaDB non-`CSE 100–199` electives; extraneous courses score inversely to prerequisite chain depth.
- **AC4 (`ortools-scheduler: AC4`)**: GE limit, credit bounds & infeasibility — at most `1` course is selected per unfulfilled GE category (`<= 1`); total `LECTURE` credits (`0` for `DISCUSSION`) never exceed `targetCredits` (soft `>= 12` preference); impossible inputs return `status: "INFEASIBLE"` with a conflict reason.
- **AC5 (`ortools-scheduler: AC5`)**: Lecture + discussion pairing & preferred gap time — selecting a `LECTURE` with discussions selects `1` prefix-matched `DISCUSSION` (fallback to any discussion for that course), and `OnlyEnforceIf` maximizes same-day pairs matching `preferredGapMinutes`.
- **AC6 (`ortools-scheduler: AC6`)**: Full-stack Playwright E2E verification — `npm run test:e2e` boots `client` (`:5173`) + `server` (`:3001`) + `agent_service` (`:8000`) and verifies the CodeGen-recorded journey end-to-end in Chromium.

## Tests

- `agent_service/tests/test_schedule_solver.py`: Acceptance tests for AC1–AC5 prefixed with `ortools-scheduler:`.
- `e2e/schedule-solver.spec.ts`: Full-stack Playwright E2E test for AC6 prefixed with `ortools-scheduler:`.
