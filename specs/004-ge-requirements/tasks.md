---
description: "Task list for GT22 GE requirements checklist"
---

# Tasks: GE Requirements Checklist (GT22)

**Input**: `specs/004-ge-requirements/spec.md`, `docs/tasks/sprint-4/GT22.md`

**Tests & Coverage Requirement**:
- Every acceptance criterion in `GT22.md` has at least one test, and every test name starts with `GT22`.
- Tests are written first and fail (red) until the implementation tasks below are done. Don't weaken a test to make it pass.
- All existing suites (`npm test`, `npm run test:agent`) must keep passing, with coverage thresholds unchanged.

---

## Phase 1: Tests (red)

- [X] T001 [P] [US1–4] Write shared schema and helper tests in `shared/tests/gt22.geRequirements.test.ts`
- [X] T002 [P] [US3–4] Write API and agent-context tests in `server/tests/gt22.geProgress.test.ts`
- [X] T003 [P] [US1–2] Write Step 3 UI tests in `client/tests/gt22.geChecklist.test.ts`
- [X] T004 [P] [US5] Write agent tool and response tests in `agent_service/tests/test_gt22_ge_requirements.py`

## Phase 2: Shared

- [ ] T005 [US1] Add `GE_REQUIREMENTS`, `GeCodeEnum`, `computeRemainingGEs`, `normalizeGeStatus` to `shared/src/onboarding.schema.ts` and re-export from `shared/src/index.ts` (FR-001, FR-003, FR-004)
- [ ] T006 [US1] Add `geCategoriesCompleted` to `OnboardingQuestionnaireSchema`; rebuild `shared` (FR-002)

## Phase 3: Server

- [ ] T007 [US3] Store `{ source, completed, remaining }` in `ProgressService.saveProgress` (FR-005)
- [ ] T008 [US4] Normalize `geStatus` in `GET /api/users/:id`, the export route, and `ContextService.assembleContext` (FR-006)

## Phase 4: Client

- [ ] T009 [US1] Replace the local `GE_CATEGORIES` with the shared `GE_REQUIREMENTS`; switch Step 3 to `geCategoriesCompleted` with no default selection; export `OnboardingPageComponent` (FR-007, FR-008)
- [ ] T010 [US2] Add the MyUCSC instruction panel and new-tab link (FR-009)
- [ ] T011 [US1] Make each GE toggle accessible (`aria-pressed` or checkbox, with label) (FR-010)

## Phase 5: Agent

- [ ] T012 [US5] Return `completedGEs` from `query_degree_ge_requirements` (FR-011)
- [ ] T013 [US5] Recommend GE courses only from `remaining` in `mock_agent.py`; drop the `CC`/`ER`/`PR-C` fallback and the hard-coded GE course list in the reply (FR-012)

## Phase 6: Verify

- [ ] T014 Run `npm test` and `npm run test:agent`; all `GT22` tests green, existing suites still green
- [ ] T015 Check Step 3 in the running app against `docs/tasks/sprint-4/GT22.md`

---

## Acceptance criteria → tests

| GT22.md acceptance criterion | Tests |
|---|---|
| Schema accepts `geCategoriesCompleted`, defaults to `[]`, rejects non-strings | shared: `GT22 [Shared] geCategoriesCompleted questionnaire field` |
| Completed `['CC','TA']` stores `completed` and a `remaining` without them | server: `stores completed GEs and derives remaining from them` |
| Skipped Step 3 stores `completed = []`, `remaining` = full list | server: `a skipped Step 3 stores completed = [] …` |
| Legacy `geCategoriesRemaining` users still load | server: `GT22 [Server API] legacy users …`, `agent context normalizes …`; shared: `normalizeGeStatus` |
| Step 3 renders MyUCSC steps in order, nothing pre-selected, toggling updates `geCategoriesCompleted` | client: all `GT22 [Client UI]` tests |
| Tool returns `remainingGEs` and `completedGEs`; agent doesn't list checked-off GEs | agent: `GT22GeToolTests`, `GT22GeAgentTests` |
| GE list matches the UCSC catalog | shared: `GE_REQUIREMENTS lists exactly the GE codes …`, `includes MF` |
| MyUCSC link opens in a new tab; toggles are accessible | client: `links to MyUCSC in a new tab`, `every GE toggle exposes an accessible checked state` |
