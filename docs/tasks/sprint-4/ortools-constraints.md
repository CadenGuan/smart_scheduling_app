---
id: ortools-constraints
story: 2
assignee: Abeetzer
sprint: 4
estimate_hours: 3
---

# OR-Tools Academic & Preference Constraints (Electives, GE Limits, Full-Time Bounds, & Preferred Gaps)

## Description

Building on top of the core OR-Tools CP-SAT scheduling engine (`ortools-scheduler`), this task adds the remaining academic and student-preference optimization constraints: personalized elective scoring, General Education (GE) category limits, full-time credit floor + infeasibility diagnostics, and preferred daily break/gap maximization between consecutive classes.

## Specs

1. **Electives & Extraneous Course Scoring (`agent_service/agent/schedule_solver.py`, `tools.py`, `mock_agent.py`)**:
   - Treat explicitly requested electives with core-level priority.
   - For undecided students, ask orientation questions (e.g., target career role or concentration), retrieve eligible non-`CSE 100–199` electives from ChromaDB degree requirements, and score descriptions via structured LLM alignment (keyword fallback in mock mode).
   - Score user-requested extraneous courses inversely to their prerequisite chain depth/effort.
2. **GE Category Limit, Full-Time Soft Floor & Infeasibility Diagnostics (`schedule_solver.py`)**:
   - Enforce `<= 1` course per unfulfilled GE category.
   - Model the `12`-unit full-time minimum as a soft objective preference when `targetCredits >= 12` (so schedules never fail unnecessarily if fewer than 12 units of eligible courses exist).
   - When constraints are mathematically impossible, return `status: "INFEASIBLE"` with structured conflict diagnostics so the agent explains *why* no valid schedule exists.
3. **Preferred Gap Time Optimization (`schedule_solver.py`)**:
   - Use CP-SAT `OnlyEnforceIf` boolean implications inside the single optimization model to award objective bonuses for same-day consecutive section pairs separated by `preferredGapMinutes` (eliminating the need for a separate Dynamic Programming post-processing pass).

## Requirements

1. **Single-Model CP-SAT Optimization**: All preference constraints (GE `<= 1`, soft `12`-unit floor, and `OnlyEnforceIf` gap bonuses) must be solved inside the same OR-Tools `CpModel` alongside core constraints.
2. **Schema Stability**: Collect orientation answers, `preferredGapMinutes`, and extraneous courses from chat/agent context without modifying `shared/src/user.schema.ts` or the preferences modal UI.
3. **TDD & Prefix Compliance**: Acceptance tests in `agent_service/tests/test_ortools_constraints.py` and `e2e/` must be prefixed with `ortools-constraints:`.
4. **Quality Gates**: `npm test`, `npm run test:agent`, `npm run test:e2e`, `npm run lint:all`, and `npm run typecheck:all` must pass cleanly.

## Acceptance criteria

- **AC1 (`ortools-constraints: AC1`)**: Electives & extraneous courses — explicit user-requested electives receive core priority; undecided orientation answers score ChromaDB non-`CSE 100–199` electives via structured LLM scoring (keyword fallback in mock mode); extraneous courses score inversely to prerequisite chain depth.
- **AC2 (`ortools-constraints: AC2`)**: GE limit, full-time floor & infeasibility — at most `1` course is selected per unfulfilled GE category (`<= 1`); schedules prefer `>= 12` units when `targetCredits >= 12` without failing if unreachable; impossible constraints return `status: "INFEASIBLE"` with a clear conflict reason.
- **AC3 (`ortools-constraints: AC3`)**: Preferred gap time — CP-SAT `OnlyEnforceIf` bonuses maximize same-day consecutive section pairs matching `preferredGapMinutes`, verified via unit tests and full-stack Playwright E2E.

## Tests

- `agent_service/tests/test_ortools_constraints.py`: Acceptance tests for AC1–AC3 prefixed with `ortools-constraints:`.
- `e2e/ortools-constraints.spec.ts`: Full-stack Playwright E2E verification for AC3 prefixed with `ortools-constraints:`.
