# Implementation Plan: Sprint 1 MVP — Smart Scheduling App

**Branch**: `001-sprint1-mvp` | **Date**: 2026-10-20 | **Spec**: [specs/001-sprint1-mvp/spec.md](spec.md)

**Input**: Feature specification from `specs/001-sprint1-mvp/spec.md`, `sprint1_mvp_plan.md`, `sprint1_architecture_design.md`, and `sprint1_questionnaire.md`.

---

## Summary

The Sprint 1 MVP delivers the foundational application shell, authentication system, student onboarding wizard, and interactive schedule preview for the Smart Scheduling App. The system is built as an npm workspaces monorepo consisting of a React 18 Class-component frontend, an Express/Node.js backend with async error-handling, a shared contract package (Zod schemas), and a local SQLite database (`app.db`) with cryptographic JWT session management and dual-mode Google Authentication.

---

## Technical Context

**Language/Version**: Node.js v20+ LTS, TypeScript 5.4+, React 18.3+

**Primary Dependencies**:
* *Backend*: `express`, `better-sqlite3`, `jsonwebtoken`, `bcryptjs`, `cors`, `zod`, `dotenv`
* *Frontend*: `react`, `react-dom`, `react-router-dom`, `zustand`, `tailwindcss`, `lucide-react`
* *Shared*: `zod`, `typescript`
* *Tooling*: `vite`, `concurrently`, `tsx`

**Storage**: Single local SQLite database (`server/data/app.db`) with Write-Ahead Logging (WAL) mode enabled via `better-sqlite3`.

**Testing**: Vitest + Supertest for backend endpoint integration; Vitest + React Testing Library for frontend component tests.

**Target Platform**: Desktop web browsers (Chrome, Safari, Firefox, Edge) running locally on student machines (macOS, Linux, Windows).

**Project Type**: Full-stack web application organized as an npm workspaces monorepo (`shared`, `client`, `server`).

**Performance Goals**: <50ms response times for all local CRUD operations, <1s cold start time, 60fps UI animations.

**Constraints**:
* Local-first data sovereignty: student data never leaves the local machine.
* Zero external service dependency required for development/grading (via dual-mode Google OAuth fallback).
* Strict adherence to React Class components and inheritance hierarchy.
* Strict adherence to Triadic Yellow (`#F9CA24`), Teal (`#00B4DB`), and Magenta (`#FF6B6B`) color system.

**Scale/Scope**: Sprint 1 MVP scope: 5-step onboarding questionnaire, 4 database tables, 9 REST API endpoints, 1 dashboard split-view layout.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

* **Principle I: Local-First Sovereignty**: PASS — System stores all credentials, sessions, and onboarding answers in local SQLite (`app.db`).
* **Principle II: End-to-End Type Safety**: PASS — Shared package (`shared/`) provides single-source-of-truth Zod schemas and TypeScript types across client and server.
* **Principle III: Clean Async Architecture**: PASS — Express layer uses `async/await` and centralized error handling, strictly forbidding nested callback pyramids.
* **Principle IV: Test-First & Independently Verifiable**: PASS — Each user story (Auth, Onboarding, Calendar Preview, Preferences) has independent acceptance criteria and automated test suites.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-sprint1-mvp/
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0: Technology decisions & best practices
├── data-model.md        # Phase 1: Database schemas, entities & state transitions
├── quickstart.md        # Phase 1: Step-by-step setup & manual verification guide
├── contracts/           # Phase 1: REST API specifications & request/response payloads
│   ├── auth.contract.md
│   ├── users.contract.md
│   └── progress.contract.md
└── tasks.md             # Phase 2: Actionable dependency-ordered tasks (generated via speckit-tasks)
```

### Source Code (repository root)

```text
smart_scheduling_app/
├── package.json                 # Monorepo root workspace configuration
├── tsconfig.base.json           # Shared base TypeScript configuration
├── shared/                      # Shared contract library
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Barrel export
│       ├── auth.schema.ts       # Login, Register, Google OAuth schemas
│       ├── user.schema.ts       # Profile & Standing types
│       ├── onboarding.schema.ts # 5-step questionnaire Zod schemas
│       └── calendar.schema.ts   # Schedule & Event item models
├── client/                      # React 18 + Vite frontend
│   ├── package.json
│   ├── vite.config.ts           # Development proxy to http://localhost:3001
│   ├── tailwind.config.js       # Triadic palette configuration
│   └── src/
│       ├── index.css            # Root CSS variables & styles
│       ├── main.tsx             # Entrypoint
│       ├── App.tsx              # Root App Class component & routes
│       ├── components/
│       │   ├── base/
│       │   │   ├── BaseComponent.tsx      # Base Class with lifecycle & safeSetState
│       │   │   ├── BaseFormView.tsx       # Base Class for form validation
│       │   │   └── BaseCardComponent.tsx  # Base Class for hover/elevation
│       │   ├── layout/
│       │   │   ├── Navbar.tsx             # Logo, Preferences button, User pill
│       │   │   └── PreferencesModal.tsx   # Slide-over preferences editor
│       │   ├── onboarding/
│       │   │   ├── OnboardingWizard.tsx   # 5-step wizard Class component
│       │   │   └── StepIndicators.tsx     # Progress bar
│       │   └── dashboard/
│       │       ├── DashboardView.tsx      # Split-view layout Class component
│       │       ├── AgentPlaceholder.tsx   # 38% width SlugAgent placeholder
│       │       ├── CalendarPreview.tsx    # 62% weekly time-grid Class component
│       │       └── CourseDetailsModal.tsx # Click popup for course info
│       ├── services/
│       │   ├── apiClient.ts               # Fetch client with Bearer auth headers
│       │   └── authService.ts             # Auth & Google login calls
│       └── utils/
│           └── withRouter.tsx             # HOC for React Router integration in Class components
└── server/                      # Express backend
    ├── package.json
    ├── tsconfig.json
    ├── data/
    │   └── app.db               # SQLite database file (WAL mode)
    └── src/
        ├── index.ts             # Server bootstrap & port listener
        ├── app.ts               # Express configuration & middleware
        ├── config.ts            # Environment variables & JWT secrets
        ├── middleware/
        │   ├── auth.middleware.ts         # JWT signature verification
        │   ├── validate.middleware.ts     # Zod schema validation
        │   ├── asyncHandler.ts            # Flat Promise error catcher
        │   └── errorHandler.ts            # Centralized error responder
        ├── routes/
        │   ├── auth.routes.ts             # /api/auth endpoints
        │   ├── users.routes.ts            # /api/users profile endpoints
        │   ├── progress.routes.ts         # /api/users/:id/progress endpoints
        │   └── calendar.routes.ts         # /api/calendar sample schedule
        ├── services/
        │   ├── auth.service.ts            # Password hashing & JWT issuance
        │   ├── google.service.ts          # Google OAuth & mock fallback
        │   └── progress.service.ts        # Onboarding persistence & skip logic
        └── db/
            ├── database.ts                # better-sqlite3 connection & WAL init
            ├── schema.sql                 # DDL definitions
            └── seed.ts                    # Sample UCSC course data
```
