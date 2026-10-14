# Architecture — Smart Scheduling App (Sprint 1, with Login)

## High-Level Architecture

Figma Demo (Login and UI) : https://www.figma.com/design/eZ5TrmCSnNOotfLTZRJWoB/Login-and-UI?node-id=0-1&t=bjkvMTSjsYCVs7D5-1

- **User's Machine**
  - Frontend (React + Vite + Tailwind)
    - LoginPage / SignupPage
    - AuthGuard (redirects unauthenticated users)
    - Onboarding questionnaire
    - Calendar preview (placeholder events)
    - Navigation and buttons
    - Skippable optional questions
  - Backend (FastAPI)
    - Auth layer
      - Register, login, logout
      - Session token issuance and verification
    - User profile endpoints
    - Onboarding progress endpoints
    - SQLite (per-user .db)
      - Users, credentials, sessions, onboarding progress

- **Not in Sprint 1**
  - Agent (LangGraph)
  - Scheduler and plan generation
  - Scraper server
  - Calendar export (.ics)
  - External APIs (LLM, search)

### Layer Responsibilities

- **Frontend** — login, signup, onboarding, preview, navigation — runs in the user's browser
- **Backend** — auth, profile persistence, progress persistence, validation — runs on the user's machine
- **Data** — SQLite per-user `.db` file — runs on the user's machine

### Key Principles

- Local-first — user data never leaves the device
- Separation of concerns — UI, auth, API, and data are isolated
- Authenticated by default — every protected route requires a valid session
- Sprint boundary — only the shell and auth are built; no agent, no scraping, no scheduling

---

## Low-Level Architecture

### Frontend Modules

- **TODO**

### Backend Modules

- **server/**
  - `main.py` — FastAPI app and route registration
  - `config.py` — settings, paths, env vars
  - `dependencies.py` — shared dependencies (db, settings, current user)
  - **api/**
    - `auth.py` — POST /api/auth/register, /login, /logout
    - `users.py` — POST/GET/PUT /api/users
    - `progress.py` — GET/PUT /api/users/{id}/progress
    - `health.py` — GET /api/health
  - **core/auth/**
    - `passwords.py` — hashing (argon2 or bcrypt)
    - `tokens.py` — JWT or opaque session tokens
    - `dependencies.py` — get_current_user
  - **schemas/**
    - `auth.py` — LoginRequest, RegisterRequest, TokenResponse
    - `user.py` — Pydantic models for profile
    - `progress.py` — Pydantic models for onboarding progress
  - **data/db/**
    - `database.py` — SQLite connection manager, WAL mode
    - `models.py` — SQLAlchemy models
    - `queries.py` — query functions
    - `migrations/` — Alembic versions

### Data Layer

- **data/**
  - **db/**
    - `database.py` — SQLite connection, WAL mode
    - `models.py` — User, Session, OnboardingProgress
    - `queries.py` — create_user, get_user, update_user, save_progress, create_session
  - **storage/**
    - `user_files.py` — manage per-user `.db` files
    - `users.json` — list of user IDs and display names

### SQLite Schema (Sprint 1)

- `users` — user_id, email, password_hash, name, major, graduation, year, interests, timestamps
- `sessions` — session_id, user_id, token, expires_at, created_at
- `onboarding_progress` — user_id, completed, skipped, last_step, updated_at

### API Endpoints (Sprint 1)

- POST `/api/auth/register` — create account
- POST `/api/auth/login` — authenticate, returns token
- POST `/api/auth/logout` — invalidate session
- POST `/api/users` — create profile
- GET `/api/users/{id}` — fetch profile
- PUT `/api/users/{id}` — update profile
- GET `/api/users/{id}/progress` — fetch onboarding progress
- PUT `/api/users/{id}/progress` — save onboarding progress
- GET `/api/health` — health check

### Request Flow (Signup)

- Frontend -> POST /api/auth/register
- api/auth.py -> validates with Pydantic
- core/auth/passwords.py -> hashes password
- data/db/queries.py -> INSERT into users
- core/auth/tokens.py -> issues session token
- Returns token -> frontend stores in authStore
- Frontend navigates to /onboarding

### Request Flow (Login)

- Frontend -> POST /api/auth/login
- api/auth.py -> validates credentials
- core/auth/passwords.py -> verifies hash
- core/auth/tokens.py -> issues session token
- data/db/queries.py -> stores session
- Returns token -> frontend stores in authStore
- Frontend navigates to /main

### Request Flow (Save Progress)

- Frontend -> PUT /api/users/{id}/progress (with Bearer token)
- core/auth/dependencies.py -> validates token
- api/progress.py -> validates with Pydantic
- data/db/queries.py -> UPSERT into onboarding_progress
- Returns updated progress -> frontend updates state

### Request Flow (Skip Question)

- Frontend -> local state update (skipped array)
- Frontend -> PUT /api/users/{id}/progress
- data/db/queries.py -> saves skipped list
- User can resume later by reading progress

### Technology Stack (Sprint 1)

- **Frontend** — React 18 + Vite + Tailwind + Zustand + React Hook Form
- **Backend** — Python 3.11 + FastAPI + Pydantic v2
- **Auth** — argon2 or bcrypt + JWT or opaque session tokens
- **Database** — SQLite (WAL mode) + SQLAlchemy 2.0 + Alembic
- **Testing** — pytest (backend), Vitest (frontend)
