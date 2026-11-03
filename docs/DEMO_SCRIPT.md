# 🎬 SlugSchedule — Live Demo & Presentation Script
**Course:** CSE 115A — Introduction to Software Engineering  
**Application:** SlugSchedule (UCSC Smart Scheduling App)  
**Target Audience:** Course Instructors, Teaching Assistants & Peers  
**Estimated Run Time:** 8–10 minutes  

---

## 🎯 Presentation Objectives
1. Demonstrate how SlugSchedule solves the multi-constraint quarterly scheduling puzzle for UCSC students.
2. Showcase the **SlugAdvisor** conversational AI agent powered by a NetworkX prerequisite DAG solver.
3. Highlight visual schedule conflict detection, degree roadmap inspection, and academic conference tracking.
4. Review the software engineering rigor: 311 automated tests, Docker containerization, OWASP security hardening, and SQLite WAL performance.

---

## 🚀 Pre-Demo Checklist
Ensure all three development services are active before beginning:

```bash
# Verify services are responding
curl -I http://localhost:5173              # Frontend Client (HTTP 200)
curl -I http://localhost:3001/api/health   # Backend API (HTTP 200)
```

Open a clean browser window to [http://localhost:5173](http://localhost:5173).

---

## 🎭 Step-by-Step Demo Flow

### Act 1: First-Time Student Experience & Onboarding (2 mins)

1. **New User Registration:**
   - Click **"Sign Up"** on the landing page.
   - Register a new test account:
     - **Name:** `Sammy Slug`
     - **Email:** `sammy.demo@ucsc.edu`
     - **Password:** `SlugPassword123!`
     - **Standing:** `Junior`
     - **Major:** `Computer Science B.S.`
   - *Key Talking Point:* "SlugSchedule features secure JWT session tokens, Argon2/BCrypt hashing, and rate-limiting against brute force attacks."

2. **Onboarding Questionnaire (Component C2):**
   - Walk through the multi-step questionnaire:
     - **Step 1:** Select target quarter (`Winter 2027`) and unit goal (`15 credits`).
     - **Step 2:** Mark completed foundational courses (`MATH 19A`, `MATH 19B`, `CSE 20`, `CSE 30`, `CSE 12`, `CSE 13S`, `CSE 16`).
     - **Step 3:** Review remaining GE categories (`CC`, `ER`, `PR`).
   - *Key Talking Point:* "Students can skip optional steps and resume anytime; answers are saved dynamically in SQLite."

3. **Interactive Spotlight Tour (Component C5):**
   - Upon completing onboarding, the **6-Step Interactive Walkthrough** will highlight:
     - Schedule timetable grid
     - Conflict alert indicators
     - Prerequisite Roadmap visualizer
     - Research conference deadlines hub
     - Conversational advising workspace
   - Complete or dismiss the tour. Notice the `"❓ Tour"` replay button in the navbar.

---

### Act 2: Weekly Schedule Timetable & Conflict Detection (2 mins)

1. **Viewing the Timetable Grid (Component C4):**
   - Point out the color-coded course blocks:
     - 🟦 **Blue:** Major core requirements (`CSE 130`, `MATH 21`).
     - 🟥 **Red:** General Education requirements (`ART 10F` for `PR` GE).
     - 🟨 **Yellow:** External commitments (`Dining Hall Work Shift` synced from Google Calendar).
   - Hover over a course block to highlight all associated lecture sections.
   - Click any course card to open the **Course Inspector Modal** with units, description, and meeting times.

2. **Conflict & Workload Fatigue Badges:**
   - Point out the real-time conflict badges:
     - `Spans preferred free day`: flags lectures scheduled on student's preferred study day.
     - `Starts before preferred time` or `Ends after preferred time`.
     - `3+ consecutive hours`: detects back-to-back cognitive overload.

3. **Standard Calendar Export:**
   - Click **"📥 Export .ics"** in the schedule header.
   - Note the downloaded `slug-schedule-winter-2027.ics`.
   - *Key Talking Point:* "This is a standard RFC 5545 iCalendar file that imports into Google Calendar or Apple Calendar with pre-configured 15-minute advance alerts."

---

### Act 3: The Conversational SlugAdvisor Agent (3 mins)

Direct attention to the right-hand **SlugAgent Workspace**.

1. **Prerequisite Pathfinding (NetworkX DAG Solver):**
   - Type prompt:
     > *"What is the shortest prerequisite path to take CSE 130?"*
   - Observe response: SlugAgent queries the degree graph, identifies completed coursework, and displays the shortest critical path sequence along with the estimated quarters to graduation.

2. **Course Drop Impact Analysis (Downstream Audit):**
   - Type prompt:
     > *"What happens if I drop CSE 101?"*
   - Observe response: SlugAgent triggers `assess_drop_impact`, warning that `CSE 101` is a critical gatekeeper course and listing immediately blocked coursework (`CSE 102`, `CSE 103`, `CSE 115A`).

3. **Burnout Mitigation & Workload Lightening:**
   - Type prompt:
     > *"This schedule is too much for me, can you lighten my load?"*
   - Observe response: The agent automatically lowers the target credit preference from 15 to 12 units and proposes swapping a heavy elective for a lighter GE course.

4. **Recommendation Rationale:**
   - Type prompt:
     > *"Why did you recommend CSE 115A for me?"*
   - Observe response: The advisor explains the recommendation based on junior degree standing, industry readiness, and conflict-free timetable fit.

---

### Act 4: Degree Roadmap & Research Opportunities (2 mins)

1. **Prerequisite Tree DAG Visualizer (Component C9):**
   - Click the **"🗺️ Prereq Roadmap"** button in the calendar header.
   - Showcase the 5-tier UCSC CS degree DAG:
     - Live progress bar (`39% Completed`).
     - Status badges: `✓ Completed`, `⚡ Ready to Enroll`, `🔒 Locked`.
     - **Live Course Search:** Type `CSE 101` in the search box to demonstrate instant real-time course filtering and empty-state handling.
     - Click `CSE 101` to view its prerequisites (`CSE 13S`, `CSE 16`) and all downstream courses it unlocks.

2. **Consolidated Research & Conference Deadlines (Backlog 2):**
   - Click the **"🎯 Deadlines"** button in the calendar header.
   - Showcase the curated opportunities for undergraduates:
     - Filter by tier: *Undergraduate Showcase* (UCSC URS, ICSE SRC, SIGMOD SRC) vs *Top Tier* (OSDI, NeurIPS).
     - Filter by topic: *Software Engineering*, *Systems*, *AI & ML*.
     - Urgency badges: *Days Left*, *Deadline Passed*.
   - Click **"📥 Export to .ics"** to export all conference deadlines with 1-day advance reminder alarms.

3. **Profile & Preferences Portability (Component C7):**
   - Click the **Settings (⚙️)** icon in the top navbar.
   - Click **"📥 Export JSON"** to download student preferences to a JSON file.
   - Demonstrate the **"📤 Import JSON"** button to restore preferences across devices.

---

### Act 5: Engineering Highlights & Architecture Q&A (1 min)

Highlight our engineering rigor to the audience:
- **Test Suite:** **311 automated tests** with 100% pass rate across TypeScript (Vitest) and Python (Pytest).
- **Architecture:** Monorepo using npm workspaces (`client`, `server`, `shared`, `agent_service`).
- **Security:** OWASP headers, CSP, brute-force rate limiters on auth routes, and Argon2/BCrypt hashing.
- **Performance:** SQLite WAL mode with 64MB page cache and Vite manual vendor chunk splitting.
- **Docker Compose:** Multi-service container orchestration with persistent SQLite volume (`npm run docker:up`).

---

## ❓ Anticipated Questions & Answers

**Q: How does the agent handle courses that the student took outside UCSC?**  
*A:* During the onboarding questionnaire and in the Preferences modal, students can specify external transfer credit (e.g., AP Computer Science, California Community College articulated courses) which are marked as satisfied in the prerequisite DAG solver.

**Q: Does Google Calendar integration require access to the student's personal emails?**  
*A:* No. The Google OAuth scope is strictly scoped to `https://www.googleapis.com/auth/calendar.events.readonly`. We only extract event start and end times to identify busy intervals and never read event descriptions or email data.

**Q: How does the calendar export handle recurring class meetings?**  
*A:* The RFC 5545 generator formats `RRULE:FREQ=WEEKLY` parameters with day-of-week recurrence rules spanning the 10-week academic quarter, including academic milestone dates (Add/Drop and Finals week) as all-day events.
