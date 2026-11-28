---
id: ortools-scheduler
story: 1
assignee: Abeetzer
sprint: 4
estimate_hours: 5
---

# Deterministic Schedule Optimization with Google OR-Tools (CP-SAT)

## Description

Our current scheduling pipeline relies on LLM reasoning (live mode) and a greedy heuristic (preview/mock mode). Because LLMs are probabilistic and greedy heuristics evaluate courses one at a time, the system can propose overlapping sections, exceed credit caps, drop discussion sections, ignore prerequisite eligibility, or schedule courses the student is not eligible to take.

This task introduces the core **Google OR-Tools CP-SAT** scheduling engine, prerequisite DAG eligibility/co-requisite rules, and full-stack UI/Playwright E2E integration in `agent_service` and `server`.

## Specs

1. **OR-Tools CP-SAT Core Solver (`agent_service/agent/schedule_solver.py`)**:
   - **Time Conflicts & Busy Blocks**: Converts all lectures, discussions, and `currentSchedule` `GOOGLE_CALENDAR_BUSY` blocks into weekday minute-intervals (`NewOptionalFixedSizeIntervalVar` / `NewFixedSizeIntervalVar`) with `AddNoOverlap` per weekday.
   - **DB Sanitization & Discussion Pairing**: Deduplicates catalog rows by `(course_code, section, section_type)`, skips `TBA` / invalid time rows, treats `DISCUSSION` rows as `0` credits (`LECTURE` defaults to `5`), and pairs each selected `LECTURE` with `1` prefix-matched `DISCUSSION` (fallback to any discussion for that course; `0` orphan discussions).
   - **Credit Cap**: Enforces total `LECTURE` credits `<= targetCredits`.
2. **Prerequisite Regex DAG Guard, Co-Requisites & Core Priority (`prereq_parser.py`, `schedule_solver.py`)**:
   - Enforce a strict `^[A-Z]{2,5}\s+\d+[A-Z]?$` regex gate in `parse_prerequisite_text_rules()` so prose/descriptions are never emitted as `"COURSE"` nodes in `course_dag.json`.
   - Filter out courses with unmet prerequisites (using cleaned `course_dag.json` + `build_ucsc_cs_dag()` fallback), enforce the `L`-lab co-requisite rule (`CSE 100L <= CSE 100` unless `CSE 100` is already completed), and prioritize core courses that unlock more downstream requirements.
3. **Full-Stack UI Bridge & Playwright E2E (`agent_api/`, `tools.py`, `mock_agent.py`, `agent.routes.ts`, `e2e/schedule-solver.spec.ts`)**:
   - Expose `/api/agent/solve/`, register `solve_schedule_tool`, hook `mock_agent.py`, and persist OR-Tools `proposedCourses` to `user_schedule` so FullCalendar renders them live.
   - Update `playwright.config.ts` to boot the full stack (`client:5173` + `server:3001` + `agent_service:8000`) and verify end-to-end via Playwright.

## Requirements

1. **Deterministic Math**: Time conflicts, busy blocks, discussion pairing, credit cap, prerequisite eligibility, and `L`-lab co-requisites must be enforced by OR-Tools CP-SAT, never by LLM reasoning.
2. **Regex DAG Safety**: `prereq_parser.py` must never emit non-course-code prose into `course_dag.json`.
3. **Contract Preservation**: Solver output must conform to `CalendarEventSchema` so `client/` and `shared/` schemas remain untouched.
4. **TDD & Prefix Compliance**: Unit/API tests in `agent_service/tests/test_schedule_solver.py` and E2E tests in `e2e/schedule-solver.spec.ts` must be prefixed with `ortools-scheduler:`.
5. **Quality Gates**: `npm test`, `npm run test:agent`, `npm run test:e2e`, `npm run lint:all`, and `npm run typecheck:all` must pass cleanly.

## Acceptance criteria

- **AC1 (`ortools-scheduler: AC1`)**: Zero time conflicts — `solve_schedule()` returns zero overlapping intervals across all selected lectures and discussions.
- **AC2 (`ortools-scheduler: AC2`)**: Busy blocks — `solve_schedule()` treats `GOOGLE_CALENDAR_BUSY` events from `currentSchedule` as fixed immovable intervals and never schedules classes over them.
- **AC3 (`ortools-scheduler: AC3`)**: DB dedup/`TBA` skip & lecture/discussion pairing — duplicate `(course_code, section, section_type)` rows are deduplicated, `TBA` rows are skipped safely, `DISCUSSION` rows carry `0` credits, and each selected `LECTURE` with discussions pairs with `1` matching `DISCUSSION` (zero orphan discussions).
- **AC4 (`ortools-scheduler: AC4`)**: Credit cap & live FullCalendar population — total credits never exceed `targetCredits`, and asking the agent to optimize a schedule persists `proposedCourses` to `user_schedule` and populates FullCalendar end-to-end (verified via Playwright).
- **AC5 (`ortools-scheduler: AC5`)**: Prerequisite regex DAG guard, eligibility, `L`-lab co-requisites & core priority — `parse_prerequisite_text_rules()` only emits `COURSE` nodes matching `^[A-Z]{2,5}\s+\d+[A-Z]?$`; `solve_schedule()` excludes courses with unmet prerequisites, enforces `L`-lab co-requisites (`CSE 100L <= CSE 100`), and prioritizes core courses that unlock more downstream requirements.

## Tests

- `agent_service/tests/test_schedule_solver.py`: Acceptance tests for AC1–AC5 prefixed with `ortools-scheduler:`.
- `e2e/schedule-solver.spec.ts`: Full-stack Playwright E2E test for AC4 prefixed with `ortools-scheduler:`.
