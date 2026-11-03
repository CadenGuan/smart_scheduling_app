# 🐌 SlugSchedule — UCSC Smart Scheduling App

[![CI / Automated Tests](https://img.shields.io/badge/tests-311%20passed-brightgreen.svg)](#testing--verification)
[![TypeScript Monorepo](https://img.shields.io/badge/monorepo-npm%20workspaces-blue.svg)](#system-architecture)
[![Python 3.11](https://img.shields.io/badge/agent-Python%203.11%20%2B%20NetworkX-yellow.svg)](#intelligent-agent-service-agent_service)
[![Docker Compose](https://img.shields.io/badge/docker-multi--service%20compose-2496ED.svg)](#docker-containerization--orchestration)

> **SlugSchedule** is an intelligent, agent-driven academic schedule generator and degree planner designed specifically for UC Santa Cruz computer science and engineering undergraduates. It balances major curriculum requirements, General Education (GE) prerequisites, external commitments, work shifts, and personal workload preferences into clean, conflict-free weekly schedules that export directly to Google Calendar and Apple Calendar.

---

## 🌟 Key Features

### 1. 🤖 Conversational Advising Agent (SlugAgent)
- **Natural Language Pacing Adjustments:** Tell the advisor *"This is too much"* to automatically drop high-stress electives and adjust quarterly unit caps.
- **Prerequisite Pathfinding:** Computes the shortest prerequisite path to gatekeeper courses (e.g. `CSE 101`, `CSE 130`, `CSE 115B`) using a NetworkX Directed Acyclic Graph (DAG) solver.
- **Drop Course Impact Analysis:** Audits downstream graduation consequences before you drop a class, identifying immediately blocked coursework and gatekeeper warnings.
- **Recommendation Rationale:** Explains *why* every course was selected based on degree standing, workload pacing, and break window constraints.
- **Conversational Memory:** Preserves multi-turn conversational context and recalls previous academic planning discussions.

### 2. 🗓️ Interactive Calendar Preview & Conflict Detection
- **Weekly Schedule Grid:** High-fidelity 8:00 AM – 8:00 PM timetable view color-coded by course type (`Major`, `GE`, and `Google Calendar Busy`).
- **Dynamic Conflict Badges:** Automatically flags schedule overlaps, preferred free-day violations, early/late time boundary violations, and back-to-back lecture fatigue (>3 consecutive hours).
- **RFC 5545 `.ics` Calendar Export:** One-click export compatible with Google Calendar, Apple Calendar, and Outlook, complete with **15-minute class alerts** and **1-day advance milestone alarms**.

### 3. 🗺️ UCSC CS Prerequisite Hierarchy & Degree Roadmap (C9)
- **Interactive 18-Course Curriculum Visualizer:** 5-tier graphical DAG representing the complete UCSC Computer Science B.S. core curriculum.
- **Degree Progress Tracking:** Live completion velocity bar (e.g. `39% Completed`), status pills (`✓ Completed`, `⚡ Ready to Enroll`, `🔒 Locked`), and real-time missing prerequisite tags.
- **Course Inspector:** Click any course node to view course credits, level, catalog description, prerequisites, and downstream unlocked coursework.

### 4. 🎯 Academic & Research Conference Deadlines (Backlog 2)
- **Consolidated Deadlines Hub:** Curated research opportunities for UCSC undergraduates, including **UCSC URS**, **ICSE SRC**, **SIGCSE**, **OSDI**, **SIGMOD SRC**, **NeurIPS**, and **CHI**.
- **Track & Urgency Filtering:** Filter by tier (*Undergraduate Showcase*, *Major Conference*, *Top Tier*) and research area (*Software Engineering*, *Systems*, *AI & ML*, *HCI*, *Databases*).
- **One-Click Deadlines `.ics` Export:** Export all research deadlines with pre-configured 1-day submission reminder alarms.

### 5. 🚶 Guided First-Time User Walkthrough (C5)
- **Interactive Spotlight Tour:** 6-step guided walkthrough highlighting key interface components: calendar controls, prerequisite roadmap, research deadlines, and the conversational agent assistant.
- **Persistent State:** Saves completion state in `localStorage` with a `"❓ Tour"` replay button on the navigation bar.

### 6. 💾 Profile & Preference Portability (C7)
- **Cross-Device JSON Export/Import:** Export your student profile, degree standing, GE status, and scheduling preferences to JSON and import them onto another device seamlessly.

### 7. 🛡️ Enterprise-Grade Security Hardening (Backlog 3)
- **OWASP HTTP Security Headers:** Full protection via `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, and `Strict-Transport-Security`.
- **Brute-Force Rate Limiting:** Sliding-window rate limiting on authentication routes (`/api/auth/login`, `/api/auth/register`) with RFC-compliant `Retry-After` headers.
- **Data Protection:** Argon2 / BCrypt password hashing, signed JWT session tokens, and strict `1mb` JSON request body size limits.

### 8. ⚡ High-Performance Architecture (Backlog 4)
- **SQLite WAL Mode & 64MB Cache:** Optimized with `PRAGMA synchronous = NORMAL;` and `PRAGMA cache_size = -64000;` for lightning-fast disk I/O.
- **Vite Production Vendor Splitting:** Client bundle split into dedicated vendor runtime (`vendor-*.js`, 45 kB gzip) and application code (`index-*.js`, 43 kB gzip) for optimal browser caching.

---

## 🏗️ System Architecture

The application is structured as a modular TypeScript + Python monorepo using npm workspaces:

```text
smart_scheduling_app/
├── client/                 # React 18 + Vite + Tailwind CSS frontend application
│   ├── src/components/     # Modular UI components (CalendarPreview, PrereqTreeModal, DeadlinesModal, TourWalkthrough)
│   ├── src/services/       # Type-safe API clients (auth, calendar, preferences, agent)
│   └── tests/              # Vitest component & integration test suite (91 tests)
├── server/                 # Node.js + Express + TypeScript REST API backend
│   ├── src/routes/         # Express routes (auth, users, calendar, progress, agent)
│   ├── src/services/       # Business logic (calendar, ICS generator, deadlines, auth)
│   ├── src/middleware/     # Auth, security headers, rate limiting, error handling
│   ├── src/db/             # SQLite database layer (WAL mode, schema, migrations)
│   └── tests/              # Vitest backend integration test suite (128 tests)
├── shared/                 # Shared TypeScript types & Zod validation schemas
│   ├── src/                # User, auth, onboarding, calendar, and deadline schemas
│   └── tests/              # Vitest schema validation test suite (33 tests)
├── agent_service/          # Python 3.11 + Django conversational advising service
│   ├── agent/              # NetworkX degree DAG solver & mock agent advising logic
│   ├── agent_api/          # Django views, prompt builders, and tool dispatchers
│   └── tests/              # Pytest test suite for agent tools & endpoints (14 tests)
├── docker-compose.yml      # Multi-service container orchestration
└── package.json            # Root workspace scripts & dependencies
```

---

## 🚀 Quickstart & Setup

### Prerequisites
- **Node.js:** `v20.x` or higher
- **Python:** `3.11.x`
- **npm:** `v10.x` or higher
- *(Optional)* **Docker & Docker Compose**

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/CadenGuan/smart_scheduling_app.git
cd smart_scheduling_app

# Install all npm workspace packages
npm install

# Setup Python virtual environment for the agent service
npm run setup:agent
```

### 2. Run in Development Mode

Run all three services concurrently in development mode with hot-reloading:

```bash
npm run dev
```

This starts:
- 🌐 **Frontend Client:** [http://localhost:5173](http://localhost:5173)
- 🔌 **Express API Server:** [http://localhost:3001](http://localhost:3001)
- 🤖 **Python Agent Service:** [http://localhost:8000](http://localhost:8000)

---

## 🐳 Docker Containerization & Orchestration

To run the entire multi-service stack inside isolated Docker containers:

```bash
# Build all Docker images
npm run docker:build

# Launch services in detached mode
npm run docker:up

# Stop all containers
npm run docker:down
```

The Docker Compose configuration provisions:
- `client`: Nginx-powered static asset server on port `80` (mapped to `5173` or `80`).
- `server`: Node.js Express backend API on port `3001` with persistent SQLite volume.
- `agent`: Python 3.11 Gunicorn agent container on port `8000`.

---

## 🧪 Testing & Verification

The codebase maintains a **100% test pass rate** across all 4 packages with **311 automated tests**:

```bash
# Run all TypeScript test suites (shared, server, client)
npm run test

# Run Python agent test suite
npm run test:agent

# Run full production build verification
npm run build

# Run TypeScript typechecks
npm run typecheck
```

### Test Breakdown
| Package | Test Framework | Passing Tests | Test Files |
| :--- | :--- | :---: | :---: |
| `shared` | Vitest | **47** (100% coverage) | 6 |
| `server` | Vitest + Supertest | **151** | 9 |
| `client` | Vitest + React DOM | **94** | 9 |
| `agent_service` | Pytest + Django Test | **19** | 1 |
| **Total** | | **311 Passed** | **25 Files** |

---

## 🔒 Security & Privacy

- **Data Ownership:** Student preference profiles are stored locally in the student's SQLite instance.
- **Calendar Privacy:** Read-only access to external Google Calendar events for schedule conflict detection without modifying user calendars.
- **Rate Limiting:** Protects authentication routes from brute force attacks using sliding-window rate limiters.
- **Input Validation:** Strict runtime schema validation using Zod and Pydantic across all request boundaries.

---

## 👥 Authors & Acknowledgments

Built for **UCSC CSE 115A (Introduction to Software Engineering)** by the Smart Scheduling App Team. Special thanks to the UC Santa Cruz Baskin School of Engineering faculty, academic advisors, and undergraduate researchers for curriculum data.
