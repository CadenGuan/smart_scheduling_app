# PO Manual Verification Guide (`ortools-constraints`)

This guide lets you manually verify **AC1–AC3** and **live UCSC catalog/preference reactivity** in the Dashboard UI (`http://localhost:5173`) using the deterministic mock agent (`USE_MOCK_AGENT=true`) backed by the live OR-Tools CP-SAT solver, `academic_catalog.db` (`CSE`, `ART`, `MATH`, `STAT`), `course_dag.json`, and `chroma_db`.

---

## 1. Acceptance Criteria Prompts (Paste into Chat)

| AC | Component | Prompt to Paste | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **AC1** | **Explicitly requested elective** | `optimize my schedule with elective STAT 80A` | `STAT 80A` is prioritized and included in the schedule and FullCalendar. |
| **AC1** | **Ineligible elective feedback** | `optimize my schedule with elective CSE 140` *(on a profile without `CSE 101` + `CSE 40` completed)* | Solver still returns a valid schedule and adds a note that `CSE 140` could not be included (missing prerequisites, time conflict, or credit cap). |
| **AC1** | **Extraneous course (shallow prereq preference)** | `optimize my schedule with extra STAT 80A and CSE 130` | Selects `STAT 80A` (no prerequisites) over `CSE 130` (deep prerequisite chain). |
| **AC2** | **GE category limit (`<= 1` per GE)** | `optimize my schedule for 20 credits` | Every `[GE: ...]` tag in Sammy's reply is from a distinct GE category (e.g., `IM`, `PE-T`, `SR`) — never two from the same category. |
| **AC2** | **Soft `12`-unit full-time floor** | `optimize my schedule for 10 credits` | Returns a valid `<= 10`-credit schedule without failing `INFEASIBLE`. |
| **AC2** | **Infeasibility diagnostics (`reason`)** | `optimize my schedule requiring CSE 20 and ART 10E for 5 credits` | Returns `No valid schedule satisfies all constraints (...)` explaining why no schedule fits within 5 credits. |
| **AC3** | **Preferred gap time (`OnlyEnforceIf`)** | 1. `optimize my schedule with a 30 min gap`<br>2. `optimize my schedule with a 15 min gap` | Populates FullCalendar with non-overlapping blocks and shifts paired discussion timings to match the requested gap. |
| **AC1 + AC3** | **Orientation goal + gap** | `optimize my schedule with a 30 min gap and machine learning interest` | Runs the solver with both `preferredGapMinutes` and `orientationGoal` and populates FullCalendar. |

---

## 2. Testing `✏️ Edit Preferences` → `optimize my schedule`

Open **✏️ Edit Preferences** in the top bar, make one of the changes below, click **Save Changes**, and then send **`optimize my schedule`** in chat to watch the schedule and FullCalendar update:

### A. Change `Declared Major` (Section 1: Academic Profile)
- **`Computer Science B.S.`** → Prioritizes CS major courses (e.g., `CSE 20`, `CSE 120` / `CSE 185E` if prerequisites are met) + **1 out-of-department GE** (e.g., `ART 10E [GE: IM]`), with major courses not labeled as `[GE: ...]`.
- **`Art B.A.`** → Switches to `ART 10E (+ Discussion)` (asynchronous lecture with timed studio/discussion on FullCalendar) + out-of-department GEs (`CSE 20 [GE: MF]`, `CSE 80N [GE: PE-T]` or `MATH 19B [GE: MF]`, `STAT 7 [GE: SR]`).
- **`Applied Mathematics B.S.`** / **`Math`** → Prioritizes `MATH` major courses (`MATH 2`, `MATH 16A`, etc.) + out-of-department GEs.
- **`Statistics`** → Prioritizes `STAT` courses + out-of-department GEs.

### B. Override Out-of-Dept GE Default (Explicit Wish)
- While set to **`Computer Science B.S.`**, send `optimize my schedule with elective CSE 80N` (or `requiring CSE 80N`).
- **Expected:** Respects your explicit request and includes `CSE 80N` even though it is inside the `CSE` department.

### C. Change `Academic Standing` (Section 1: Academic Profile)
- Set Standing to **`Freshman`** (with no upper-division prerequisites checked) and run `optimize my schedule`.
- **Expected:** Excludes `200+` graduate courses and unparsed `100+` upper-division courses, keeping eligible lower-division courses (`CSE 20`, `ART 10E`, `MATH 2`, etc.).

### D. Change `Target Unit Load` Slider (Section 2: Quarter Capacity)
- Drag **Target Unit Load** between **`10 Credits`**, **`15 Credits`**, and **`20 Credits`**, save, and run `optimize my schedule`.
- **Expected:**
  - `10 Credits`: schedules 1–2 courses (`<= 10` credits) without failing.
  - `15 Credits`: aims for `>= 12` units (`2 major + 1 out-of-dept GE` when `2+` major courses are eligible).
  - `20 Credits`: scales up to 3–4 non-overlapping courses (`<= 20` credits) while keeping all `[GE: ...]` categories distinct.
