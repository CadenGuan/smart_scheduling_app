# 🐌 SlugSchedule — Final Project Release & Verification Report
**Course:** CSE 115A — Introduction to Software Engineering  
**Institution:** University of California, Santa Cruz  
**Release Version:** v1.0.0 (Production Ready)  
**Date:** November 3, 2026  
**Repository:** [https://github.com/CadenGuan/smart_scheduling_app](https://github.com/CadenGuan/smart_scheduling_app)  

---

## 1. Executive Summary

**SlugSchedule** is an intelligent, agent-driven academic schedule generator and degree planning platform built for UC Santa Cruz computer science and engineering undergraduates. The platform resolves the multi-constraint optimization problem students face each quarter by harmonizing:
- UCSC major core curriculum sequences and strict prerequisite DAG dependencies.
- General Education (GE) degree requirements (`CC`, `ER`, `PR`, `IM`, `TA`, etc.).
- Personal pacing, credit targets, and preferred time/break windows.
- External commitments (e.g. dining hall shifts, campus jobs) imported via Google Calendar.

The application produces conflict-free, timestamped quarterly schedules that export directly to standard calendar formats (RFC 5545 `.ics`) and features an interactive conversational advising agent (SlugAgent) backed by NetworkX degree graph pathfinding.

---

## 2. Sprint & Backlog Deliverables Inventory

### Sprint 1: Intake & Schedule Preview Foundation
- [x] **Introductory Intake Questionnaire (C2):** Multi-step wizard collecting student name, major, degree standing, and remaining GE requirements with skip/resume mechanics.
- [x] **Weekly Schedule Timetable Grid (C4):** Interactive 8:00 AM – 8:00 PM timetable color-coded by course classification (`Major`, `GE`, `External Commitment`).
- [x] **Google Account Integration:** Seamless authentication flow and read-only Google Calendar commitment import.
- [x] **Interactive UI Polish:** Dynamic hover states, course inspector dialogs, and responsive layout.

### Sprint 2: Intelligent Conversational Advising
- [x] **Conversational SlugAdvisor Agent (C8):** Persona-driven advising assistant specialized in UCSC degree pathways.
- [x] **First-Time Greeting & Capability Discovery:** Automatically explains features and guides new students.
- [x] **Multi-Turn Conversational Memory:** Preserves multi-turn dialogue history in SQLite, recalling prior scheduling discussions.
- [x] **Recommendation Rationale Explanations:** Explains *why* specific courses are proposed (degree velocity, prerequisite unblocking, workload spacing).

### Sprint 3: Degree Pacing, Workload Balancing & Prerequisite Graph Analysis
- [x] **Conversational Preference Modifications:** Modify credit caps or preferred break intervals in chat without restarting sessions.
- [x] **Burnout & Workload Mitigation ("This is too much"):** Automatically detects student distress or overload and lightens course loads with balanced alternatives.
- [x] **Downstream Course Drop Impact Analyzer:** Evaluates gatekeeper ramifications and reports future delayed coursework before a student drops a class.
- [x] **Shortest Prerequisite Pathfinding (NetworkX DAG):** Calculates exact sequence order and estimated quarters to enroll in bottleneck courses (e.g. `CSE 101`, `CSE 130`).

### Sprint 4: Calendar Interoperability & Portability
- [x] **Standard RFC 5545 `.ics` Export:** Export schedules to Google Calendar, Apple Calendar, and Outlook with **15-minute lecture alerts** and **1-day advance milestone alarms**.
- [x] **Degree Profile Portability:** Export student profiles and preference sets to JSON and import them across devices.
- [x] **First-Time User Guided Tour (C5):** 6-step spotlight tour walkthrough with keyboard navigation and replay controls.
- [x] **Prerequisite Tree DAG Visualizer (C9):** 5-tier graphical DAG representing the complete UCSC CS 18-course core curriculum with live completion percentage and readiness pills.

### Product Backlog Items: Engineering Excellence
- [x] **Multi-Service Docker Containerization (Item 1):** Production-grade Dockerfiles for `client` (Nginx), `server` (Node.js/Express), and `agent_service` (Python 3.11/Django) orchestrated via `docker-compose.yml`.
- [x] **Academic & Research Conference Deadlines Hub (Item 2):** Consolidated deadlines view for undergraduate showcases (UCSC URS, ICSE SRC, SIGCSE) and top-tier venues (OSDI, NeurIPS) with 1-day advance reminder `.ics` export and agent tool integration.
- [x] **OWASP Security Hardening (Item 3):** Content Security Policy, MIME-sniffing protection, clickjacking defense, HSTS, sliding-window rate limiting on auth endpoints, and payload size bounds.
- [x] **High-Performance Database & Bundling (Item 4):** SQLite WAL mode with 64MB page cache (`PRAGMA cache_size = -64000;`) and Vite vendor runtime chunk splitting.
- [x] **Comprehensive Test Suite (Item 5):** **314 automated tests** with a **100% pass rate** across all packages.

---

## 3. Architecture & Component Mapping

| Low-Level Component | Implementation File(s) | Technology / Pattern |
| :--- | :--- | :--- |
| **C1. Authentication & Route Protection** | `client/src/components/base/AuthGuard.tsx`<br>`server/src/routes/auth.routes.ts` | JWT, Argon2/BCrypt, Zustand store |
| **C2. Onboarding Questionnaire** | `client/src/pages/OnboardingPage.tsx`<br>`shared/src/onboarding.schema.ts` | Zod validation, Step indicators, SQLite persistence |
| **C4. Calendar Timetable & Conflict Grid** | `client/src/components/dashboard/CalendarPreview.tsx`<br>`server/src/services/calendar.service.ts` | Conflict badges, cluster calculation, time slot geometry |
| **C5. Interactive Tour Walkthrough** | `client/src/components/dashboard/TourWalkthrough.tsx` | Spotlight overlay, step indicators, localStorage |
| **C7. Preferences & JSON Portability** | `client/src/components/layout/PreferencesModal.tsx` | JSON schema validation, blob file download / file upload |
| **C8. Conversational Agent Service** | `agent_service/agent/mock_agent.py`<br>`server/src/services/context.service.ts` | NetworkX DAG solver, multi-turn memory recall |
| **C9. Prerequisite Hierarchy DAG** | `client/src/components/dashboard/PrereqTreeModal.tsx`<br>`server/src/services/calendar.service.ts` | Tiered DAG visualizer, node inspector, velocity metrics |
| **Backlog 1. Docker Compose** | `docker-compose.yml`<br>`client/Dockerfile`, `server/Dockerfile`, `agent_service/Dockerfile` | Multi-stage Docker builds, persistent named SQLite volume |
| **Backlog 2. Research Deadlines Hub** | `client/src/components/dashboard/DeadlinesModal.tsx`<br>`server/src/services/deadlines.service.ts` | Filterable deadlines catalog, RFC 5545 VALARM export |
| **Backlog 3. Security Hardening** | `server/src/middleware/security.middleware.ts`<br>`server/src/middleware/rateLimiter.ts` | OWASP headers, sliding-window rate limiting, CSP |
| **Backlog 4. Performance Optimization** | `server/src/db/database.ts`<br>`client/vite.config.ts` | SQLite 64MB cache, normal sync, Vite vendor chunk splitting |

---

## 4. Automated Testing Verification Matrix

```text
================================================================================
TOTAL AUTOMATED TESTS: 314 PASSED | 0 FAILED | 25 TEST FILES
================================================================================

1. shared package (Vitest):
   ✓ tests/auth.schema.test.ts        (5 tests)
   ✓ tests/user.schema.test.ts        (17 tests)
   ✓ tests/onboarding.schema.test.ts  (4 tests)
   ✓ tests/calendar.schema.test.ts    (8 tests)
   ✓ tests/deadline.schema.test.ts    (4 tests)
   ✓ tests/agent.schema.test.ts       (9 tests)
   Result: 47 / 47 passed (100% code coverage)

2. server package (Vitest + Supertest):
   ✓ tests/auth.test.ts               (7 tests)
   ✓ tests/preferences.test.ts        (38 tests)
   ✓ tests/progress.test.ts           (3 tests)
   ✓ tests/calendar.service.test.ts   (39 tests)
   ✓ tests/calendarQueries.test.ts    (9 tests)
   ✓ tests/agent.test.ts              (13 tests)
   ✓ tests/ics.test.ts                (6 tests)
   ✓ tests/security.test.ts           (7 tests)
   ✓ tests/fullCoverage.test.ts       (31 tests)
   Result: 153 / 153 passed

3. client package (Vitest + React DOM Server):
   ✓ tests/authStore.test.ts          (5 tests)
   ✓ tests/tourWalkthrough.test.ts    (8 tests)
   ✓ tests/deadlinesModal.test.ts     (7 tests)
   ✓ tests/prereqTreeModal.test.ts    (9 tests)
   ✓ tests/services.test.ts           (20 tests)
   ✓ tests/agentWorkspace.test.ts     (7 tests)
   ✓ tests/conflictBadges.test.ts     (15 tests)
   ✓ tests/preferencesModal.test.ts   (15 tests)
   ✓ tests/dashboardIntegration.test.ts (9 tests)
   Result: 95 / 95 passed

4. agent_service package (Pytest + Django):
   ✓ tests/test_agent_api.py          (19 tests)
   Result: 19 / 19 passed
```

---

## 5. Live E2E Verification Results

A 10-stage end-to-end integration scenario was conducted against the live running stack:
1. **Health Verification:** `GET /api/health` responded `status: ok`.
2. **Account Creation:** `POST /api/auth/register` issued signed JWT token.
3. **Onboarding Persistence:** `PUT /api/users/:id/progress` confirmed step 3 completion.
4. **Preference Ingestion:** `PUT /api/users/:id/preferences` saved 15-unit target and Friday free-day rule.
5. **Schedule Computation:** `GET /api/calendar/preview` resolved 4 course meetings and identified lunch work shift commitments.
6. **Degree DAG Resolution:** `GET /api/calendar/curriculum` identified `MATH 19A`, `CSE 20`, and `CSE 12` as unblocked for immediate enrollment.
7. **Research Hub Filtering:** `GET /api/calendar/deadlines?topic=Software%20Engineering` retrieved upcoming submissions for ICSE SRC 2027 and UCSC URS 2027.
8. **Calendar Export (.ics):** Generated valid RFC 5545 files for both the schedule (with 15-minute alerts) and research deadlines (with 1-day alerts).
9. **Conversational Agent DAG:** Accurately solved the 8-course critical prerequisite path to `CSE 130`.
10. **Conversational Agent Advising:** Dispatched `query_conference_deadlines` and advised students on undergraduate research targets.

---

## 6. Deployment & Execution Instructions

### Local Development
```bash
# 1. Install dependencies & configure Python virtual environment
npm install
npm run setup:agent

# 2. Run dev servers (client, server, agent)
npm run dev
```

### Production Docker Launch
```bash
# Build and run all services in isolated containers
npm run docker:build
npm run docker:up
```

---

## 7. Conclusion

SlugSchedule successfully fulfills all functional, architectural, and quality benchmarks set forth in the course specifications. The repository stands fully integrated, containerized, documented, and production-ready on `origin/main`.
