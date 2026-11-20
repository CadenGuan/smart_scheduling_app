# Feature Specification: GE Requirements Checklist

**Feature Branch**: `GT22`  
**Created**: 2026-11-19  
**Status**: Implemented  
**Input**: Sprint 4 Task GT22 (`docs/tasks/sprint-4/GT22.md`)

---

## 1. Problem Statement

Step 3 of the onboarding questionnaire asks students to pick the GE requirements they have **remaining** and pre-selects `CC` and `ER`. Most students don't know their remaining GEs offhand, and the pre-selection means the agent can receive answers the student never gave. The GE list in `OnboardingPage.tsx` is also out of date: it is missing `MF` and `DC`.

GT22 changes Step 3 so students check off the GE requirements they have **already satisfied**, and shows them how to look these up in MyUCSC. The server derives the remaining list from the completed one, so the agent only recommends GEs the student still needs.

GE source of truth: [UCSC General Catalog 2026-27, General Education Requirements](https://catalog.ucsc.edu/en/current/general-catalog/undergraduate-information/undergraduate-academic-program/general-education-requirements).

| Code | Requirement | Note |
|---|---|---|
| CC | Cross-Cultural Analysis | |
| ER | Ethnicity and Race | |
| IM | Interpreting Arts and Media | |
| MF | Mathematical and Formal Reasoning | missing from current list |
| SI | Scientific Inquiry | |
| SR | Statistical Reasoning | |
| TA | Textual Analysis and Interpretation | |
| PE | Perspectives | one course from any of PE-E, PE-H, PE-T |
| PR | Practice | one course (min. 2 credits) from any of PR-C, PR-E, PR-S |
| C | Composition | single requirement (not C1/C2) |
| DC | Disciplinary Communication | satisfied through major courses; missing from current list |

---

## 2. User Scenarios & Testing

All tests start with the task ID `GT22` and live in the folders the test runners already scan.

| Layer | Test file |
|---|---|
| Shared | `shared/tests/gt22.geRequirements.test.ts` |
| Server | `server/tests/gt22.geProgress.test.ts` |
| Client | `client/tests/gt22.geChecklist.test.ts` |
| Agent | `agent_service/tests/test_gt22_ge_requirements.py` |

### User Story 1 - Check off satisfied GEs (Priority: P1) 🎯 MVP

As a student, I want to check off the GE requirements I've already satisfied, so the scheduler only plans GEs I still need.

- **Acceptance Scenarios**:
  1. **Given** a new student on Step 3, **When** the step renders, **Then** it asks which GE requirements they have already satisfied and no GE is selected.
  2. **Given** Step 3, **When** it renders, **Then** there is one toggle per catalog GE (code and full name), each exposing its checked state to screen readers.
  3. **Given** the student toggles `CC`, **When** they toggle it again, **Then** `geCategoriesCompleted` goes `['CC']` → `[]`.
  4. **Given** the student checks off several GEs, **When** the step re-renders, **Then** exactly those toggles show as selected.
  5. **Given** Step 3, **When** it renders, **Then** the GE Fulfillment Source selector is still there.

### User Story 2 - Learn where to find completed GEs (Priority: P1)

As a student who doesn't remember which GEs I've finished, I want instructions on where to find them.

- **Acceptance Scenarios**:
  1. **Given** Step 3, **When** it renders, **Then** the steps MyUCSC → My Academics → Degree Progress Report → General Education Requirements (expand) are visible in that order, with no click needed.
  2. **Given** the MyUCSC link, **When** it is clicked, **Then** it opens `https://my.ucsc.edu` in a new tab (`target="_blank"`, `rel` includes `noopener`).

### User Story 3 - Persist completed and remaining GEs (Priority: P1)

As the system, I want to store both what the student completed and what remains, so the rest of the app and the agent read one consistent status.

- **Acceptance Scenarios**:
  1. **Given** completed `['CC', 'TA']`, **When** progress is saved, **Then** `geStatus` is `{ source, completed: ['CC','TA'], remaining: <all other GEs> }`.
  2. **Given** a skipped Step 3, **When** progress is saved, **Then** `completed = []` and `remaining` is every GE.
  3. **Given** an unknown code such as `NOT-A-GE`, **When** progress is saved, **Then** the API returns 400 and the stored status is unchanged.
  4. **Given** draft answers with `geCategoriesCompleted`, **When** the student resumes onboarding, **Then** their checked GEs are restored.

### User Story 4 - Legacy users keep working (Priority: P2)

- **Acceptance Scenarios**:
  1. **Given** a user whose stored `geStatus` only has `remaining: ['CC','ER']`, **When** it is read by the API or the agent context, **Then** `completed` is derived as every other GE.
  2. **Given** malformed or missing stored GE data, **When** it is normalized, **Then** `completed = []`, `source = 'UCSC'`, and every GE remains.

### User Story 5 - Agent respects satisfied GEs (Priority: P1)

As a student, I want the agent never to recommend a GE I've already satisfied.

- **Acceptance Scenarios**:
  1. **Given** a `geStatus` with `completed`, **When** `query_degree_ge_requirements` runs, **Then** it returns `completedGEs` and `remainingGEs` with no overlap.
  2. **Given** a legacy `geStatus` without `completed`, **When** the tool runs, **Then** `completedGEs = []`.
  3. **Given** only `TA` and `IM` remain, **When** the student asks "What GEs do I still need?", **Then** the reply names `TA` and `IM` and does not present `CC`, `ER` or `PR` as GEs to take.
  4. **Given** `CC`, `ER` and `PR` are satisfied, **When** the agent proposes courses, **Then** none of them is a course for a satisfied GE.
  5. **Given** every GE is satisfied, **When** the student asks about GEs, **Then** the agent says so and proposes no GE courses.

---

## 3. Edge Cases & Constraints

1. **No pre-selection**: the agent must never treat a GE as satisfied unless the student checked it off.
2. **PE / PR sub-areas**: one checklist entry each; any sub-area satisfies it. Sub-area codes (`PE-H`, `PR-C`, …) are not valid checklist values.
3. **Duplicates**: duplicate completed codes don't change the remaining list.
4. **Single source of truth**: the GE list is defined once in `shared` and imported by the client, the server and the tests.

---

## 4. Requirements Matrix

| ID | Layer | Requirement | Covered by |
|---|---|---|---|
| **FR-001** | Shared | Export `GE_REQUIREMENTS` (code + name, catalog order) and `GeCodeEnum` from `onboarding.schema.ts` and the package index. | shared |
| **FR-002** | Shared | Add `geCategoriesCompleted: z.array(GeCodeEnum).default([])` to `OnboardingQuestionnaireSchema`. | shared, server |
| **FR-003** | Shared | `computeRemainingGEs(completed)` returns all GEs minus `completed`, in catalog order. | shared |
| **FR-004** | Shared | `normalizeGeStatus(raw)` returns `{ source, completed, remaining }` from new, legacy, or malformed data. | shared, server |
| **FR-005** | Server | `ProgressService.saveProgress` stores `ge_status` with `source`, `completed`, and derived `remaining`. | server |
| **FR-006** | Server | `GET /api/users/:id` and `ContextService.assembleContext` return a normalized `geStatus`. | server |
| **FR-007** | Client | Step 3 asks for satisfied GEs, uses the shared list, and pre-selects nothing. | client |
| **FR-008** | Client | `handleToggleGE` updates `geCategoriesCompleted`; `OnboardingPageComponent` is exported for tests. | client |
| **FR-009** | Client | Step 3 shows the MyUCSC lookup steps and a new-tab link to `https://my.ucsc.edu`. | client |
| **FR-010** | Client | Each GE toggle has an accessible label and checked state (`aria-pressed` or a checkbox). | client |
| **FR-011** | Agent | `query_degree_ge_requirements` returns `completedGEs` alongside `remainingGEs`. | agent |
| **FR-012** | Agent | GE recommendations come only from `remaining`; no fallback to hard-coded GEs. | agent |
