# Handoff Documentation: Smart Scheduling App

## 1. Current State & Git Status
- **Current Branch:** `main` (up to date with `origin/main`, commit `fafded2`)
- **Working Tree:** Clean (all prior PRs `#4` and `#5` merged)
- **Repo Root:** `c:\Users\abize\OneDrive\Documents\CSE115A\smart_scheduling_app`

---

## 2. The Core Issue
### User Complaint
> *"if my major is econ then why tf am I seeing cse 101"*
> *"i dont like how ad hoc the algorithm implementation is I still couldnt get the change in major to change the class. theres two possibilities: 1. theres a fuck up on the algorithm or 2. theres a fuckup on the mock catalog which is it"*

### Root Cause Diagnosis: Both (Catalog Starvation + Algorithm Fallback)
1. **Catalog Starvation (`data/courses.json` and `server/src/db/seed.ts`)**:
   - `Winter 2027` (the app's default active term) only contains `CSE 101` (x2 sections), `CSE 115A`, `CSE 130`, `ART 10F`, `CSE 12`, and a Google Calendar shift.
   - **There are zero ECON courses for Winter 2027 in the entire catalog.**
   - Across all terms, there is only one single Econ course: `ECON 1` in `Fall 2026`.
   - Therefore, it is mathematically impossible to schedule 15 credits of Economics courses in Winter 2027 without drafting non-major courses.

2. **Algorithm Fallback (`server/src/services/calendar.service.ts`)**:
   - In `getPreview()`, major mismatch is treated only as a **soft penalty** (`SCORING_PENALTIES.NON_MAJOR_COURSE = 15`).
   - The greedy loop enforces: `while (currentCredits < targetCredits && ...)` (target: 15 credits).
   - Because no Econ courses exist, the algorithm picks `ART 10F` (GE penalty: 5), and is still 10 credits short.
   - It then selects the lowest-penalty remaining options, which are all CSE courses (`CSE 101`, `CSE 115A`), happily drafting them for an Econ major.

3. **Live Service Gap (`isUsingMockAgent() === false`)**:
   - In `CalendarService.handleMacroHardPivot()`, when a user changes their major/standing, it wipes `user_calendar_events` in SQLite (`calendarQueries.deleteUserCalendarEvents(userId)`).
   - However, baseline re-generation is guarded by `if (isMock)`. In live mode, it generates nothing and leaves the calendar blank.
   - When the user asks the live agent for recommendations, Django queries `data/courses.json`. Because that file has 0 Econ courses for Winter 2027, the agent either hallucinates courses or returns `proposedCourses: []`.

---

## 3. Action Items for Next Session

### Step 1: Expand Catalog Data (`seed.ts` & `data/courses.json`)
Add a realistic selection of Economics courses across terms (especially for `Winter 2027` and `Fall 2026`):
- `ECON 1`: Introductory Microeconomics (Lower div, 5 cr)
- `ECON 2`: Introductory Macroeconomics (Lower div, 5 cr)
- `ECON 100A`: Intermediate Microeconomics (Upper div, 5 cr)
- `ECON 100B`: Intermediate Macroeconomics (Upper div, 5 cr)
- `ECON 113`: Introduction to Econometrics (Upper div, 5 cr)
- Ensure they are present in both:
  - `data/courses.json` (consumed by Django live agent & course search tool)
  - `server/src/db/seed.ts` (consumed by `sampleCalendarEvents` in server mock mode)

### Step 2: Refine Greedy Course Selection in `calendar.service.ts`
- **Hard Major Filtering:** When major courses exist in the candidate pool for the target term, strictly prioritize major courses and General Education (GE) courses.
- **Foreign Major Exclusion:** Prevent core major courses of completely unrelated departments (e.g. `CSE 101`, `CSE 130`) from being drafted as filler electives for non-majors unless explicitly pinned or no GEs/electives exist.
- Ensure class standing constraints (lower-division vs upper-division) correctly respect Econ course levels.

### Step 3: Handle Live Service Hard Pivots
- In `CalendarService.handleMacroHardPivot()`, ensure that in live mode, if the user pivots major/standing, they either:
  - Receive a sane deterministic baseline schedule from catalog, OR
  - Trigger an agent recommendation query so the user isn't stranded with an empty calendar.

---

## 4. Key Files & Architecture Pointers

| File | Role |
| :--- | :--- |
| [`server/src/services/calendar.service.ts`](file:///c:/Users/abize/OneDrive/Documents/CSE115A/smart_scheduling_app/server/src/services/calendar.service.ts) | Greedy selection (`getPreview`), `SCORING_PENALTIES`, `handleMacroHardPivot` |
| [`server/src/db/seed.ts`](file:///c:/Users/abize/OneDrive/Documents/CSE115A/smart_scheduling_app/server/src/db/seed.ts) | `sampleCalendarEvents` seed catalog |
| [`data/courses.json`](file:///c:/Users/abize/OneDrive/Documents/CSE115A/smart_scheduling_app/data/courses.json) | Course catalog loaded by Django agent tools |
| [`server/src/services/agent.service.ts`](file:///c:/Users/abize/OneDrive/Documents/CSE115A/smart_scheduling_app/server/src/services/agent.service.ts) | Bridges Node server to Django agent (`/api/agent/process/`) |
| [`server/src/routes/agent.routes.ts`](file:///c:/Users/abize/OneDrive/Documents/CSE115A/smart_scheduling_app/server/src/routes/agent.routes.ts) | Chat endpoint, passes `proposedCourses` to `getPreview` |
| [`agent_service/agent/agent.py`](file:///c:/Users/abize/OneDrive/Documents/CSE115A/smart_scheduling_app/agent_service/agent/agent.py) | Live Gemini agent with LangChain |
| [`server/tests/calendar.service.test.ts`](file:///c:/Users/abize/OneDrive/Documents/CSE115A/smart_scheduling_app/server/tests/calendar.service.test.ts) | Unit tests for greedy algorithm & macro pivots |

---

## 5. Verification Commands
Before submitting or creating a PR:
- `npm test` (350+ tests across shared, server, client)
- `npm run test:agent` (Django/pytest suite)
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run build`
