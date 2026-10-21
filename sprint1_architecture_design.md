# Architecture — Smart Scheduling App (Sprint 1, with Monorepo & Login)

## High-Level Architecture

- **Project Workspace Structure (npm workspaces monorepo)**
  - `package.json` — Root workspace orchestrating `client`, `server`, and `shared` packages with concurrent execution (`npm run dev`)
  - `shared/` — Shared TypeScript types and Zod schemas used across both client and server
  - `client/` — Frontend (React 18 + Vite + Tailwind CSS + Zustand + React Hook Form)
    - LoginPage / SignupPage (Email/Password & Google Sign-In button)
    - AuthGuard (redirects unauthenticated users)
    - Onboarding questionnaire (name, standing, major/minor, GEs, major requirements, breaks, quarter target)
    - Calendar preview (placeholder events)
    - Navigation and button actions
    - Skippable optional questions
    - Vite dev proxy (`/api` -> backend) eliminating CORS hurdles
  - `server/` — Backend (Node.js v20+ LTS + Express + TypeScript + Zod)
    - Auth layer
      - Register, login, logout
      - Session token issuance and verification
      - Google Cloud OAuth 2.0 authorization & token exchange
      - Google Calendar token persistence in `oauth_tokens` table
    - User profile endpoints
    - Onboarding progress endpoints
    - SQLite (Single local `app.db` with WAL mode)
      - `users`, `sessions`, `onboarding_progress`, `oauth_tokens`

- **Not in Sprint 1**
  - Agent (LangGraph.js / LLM agent)
  - Scheduler and plan generation
  - Scraper server
  - Calendar export (.ics)
  - Active LLM constraint solving over Google Calendar events (reserved for Sprint 2/3 agent planning)
  - External APIs (LLM, Web search)

### Layer Responsibilities

- **Frontend (`client/`)** — login, signup, onboarding wizard, preview, navigation — runs in the user's browser
- **Shared (`shared/`)** — single source of truth for validation schemas (Zod) and TypeScript types
- **Backend (`server/`)** — auth, profile persistence, progress persistence, validation — runs locally on Node.js
- **Data (`server/data/app.db`)** — single local SQLite database file — runs on the user's machine

### Key Principles

- **Local-first** — user data remains on the device in a unified local SQLite database
- **Unified TypeScript monorepo** — shared validation schemas and contracts prevent client-server drift
- **Relative API pathing via Vite proxy** — clean client calls without CORS overhead
- **Authenticated by default** — every protected route requires a valid session token
- **Sprint boundary** — only the shell, auth, and onboarding state are built; no agent, scraping, or complex scheduling

---

## Low-Level Architecture & Workspace Layout

### Monorepo Structure

```text
smart_scheduling_app/
├── package.json               # Root workspace configuring packages: ["shared", "client", "server"]
├── tsconfig.base.json         # Shared TypeScript compiler options
├── shared/                    # Shared types and validation contracts
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # Barrel export
│       ├── auth.ts            # Auth schemas & types (Login, Register, Token)
│       ├── user.ts            # User profile types & Standing enum
│       └── onboarding.ts      # Questionnaire schemas (major, GEs, requirements, breaks)
├── client/                    # React 18 frontend
│   ├── package.json
│   ├── vite.config.ts         # Configures /api proxy to http://localhost:3001
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx           # Entrypoint
│       ├── App.tsx            # Routes and root layout
│       ├── components/
│       │   ├── AuthGuard.tsx  # Auth protection wrapper
│       │   ├── Navbar.tsx     # Navigation & logout
│       │   ├── CalendarPreview.tsx # Placeholder calendar component
│       │   ├── QuestionnaireStep.tsx # Wizard steps
│       │   └── ui/            # Reusable UI primitives (Button, Dropdown, Input, Card)
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── SignupPage.tsx
│       │   ├── OnboardingPage.tsx
│       │   └── DashboardPage.tsx
│       ├── store/
│       │   ├── authStore.ts       # Zustand session & user state
│       │   └── onboardingStore.ts # Zustand step & answer state
│       └── services/
│           ├── apiClient.ts       # Axios/fetch instance using relative paths (/api/...)
│           ├── authService.ts
│           ├── userService.ts
│           └── progressService.ts
└── server/                    # Express backend
    ├── package.json
    ├── tsconfig.json
    ├── data/
    │   └── app.db             # Single local SQLite database (WAL mode)
    └── src/
        ├── index.ts           # Server bootstrap and port listener (default: 3001)
        ├── app.ts             # Express app setup and middleware
        ├── config.ts          # Environment variables and DB paths
        ├── middleware/
        │   ├── auth.ts        # requireAuth middleware (Bearer token check)
        │   ├── validate.ts    # Zod schema validation middleware
        │   └── errorHandler.ts# Centralized error handler
        ├── routes/
        │   ├── auth.routes.ts # /api/auth (register, login, logout, google)
        │   ├── users.routes.ts# /api/users
        │   ├── progress.routes.ts # /api/users/:id/progress
        │   └── health.routes.ts   # /api/health
        ├── services/
        │   ├── auth.service.ts
        │   ├── user.service.ts
        │   └── progress.service.ts
        └── db/
            ├── database.ts    # better-sqlite3 connection manager with WAL mode
            ├── schema.sql     # DDL definitions
            ├── migrations/    # Schema migration files
            └── queries/
                ├── userQueries.ts
                ├── sessionQueries.ts
                └── progressQueries.ts
```

---

## Data Layer & Single SQLite Database

Instead of per-user database files, the system uses a single local database file: `server/data/app.db`.

### SQLite Schema (Sprint 1)

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,                     -- Nullable if authenticating exclusively via Google OAuth
  name TEXT NOT NULL,
  standing TEXT NOT NULL,                 -- Freshman, Sophomore, Junior, Senior, Graduate
  major TEXT NOT NULL,
  minor TEXT,
  intended_major TEXT,
  ge_status TEXT,                         -- JSON or summary of completed GEs / transfer credits
  major_requirements_taken TEXT,          -- JSON array of course codes completed
  breaks_preference TEXT,                 -- JSON of break preferences / soft constraints
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Onboarding progress table
CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT 0,
  last_step INTEGER DEFAULT 0,
  skipped_steps TEXT DEFAULT '[]',        -- JSON array of skipped step keys
  draft_answers TEXT DEFAULT '{}',        -- JSON payload of in-progress responses
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OAuth Tokens (For Google Calendar / Google Sign-in integration)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                 -- 'google'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  expires_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints (Sprint 1)

- POST `/api/auth/register` — create account with email & password
- POST `/api/auth/login` — authenticate with credentials, returns session token
- POST `/api/auth/logout` — invalidate active session
- POST `/api/auth/google` — authenticate or link account via Google OAuth 2.0 token
- POST `/api/users` — create user profile
- GET `/api/users/:id` — fetch user profile
- PUT `/api/users/:id` — update user profile
- GET `/api/users/:id/progress` — fetch onboarding progress
- PUT `/api/users/:id/progress` — save onboarding progress & draft answers
- GET `/api/health` — health check

---

## Request Flows

### Request Flow (Signup / Register)
1. Frontend -> POST `/api/auth/register` (relative path via Vite proxy).
2. Express `routes/auth.routes.ts` validates payload using `RegisterRequestSchema` from `shared/`.
3. `services/auth.service.ts` hashes password with argon2/bcrypt.
4. `db/queries/userQueries.ts` inserts user into `users` in `app.db`.
5. `services/auth.service.ts` generates session token and persists to `sessions`.
6. Client receives token, sets `authStore`, and redirects to `/onboarding`.

### Request Flow (Login)
1. Frontend -> POST `/api/auth/login`.
2. Validated with `LoginRequestSchema` from `shared/`.
3. Credentials verified against `users` table; new session row created in `sessions`.
4. Returns session token; frontend stores token and redirects to `/dashboard` (or `/onboarding` if incomplete).

### Request Flow (Save / Skip Onboarding Progress)
1. Frontend -> PUT `/api/users/:id/progress` with `Bearer <token>` header.
2. `middleware/auth.ts` verifies session in `sessions` table and attaches user to request.
3. Express validates payload using `OnboardingProgressSchema` from `shared/`.
4. `db/queries/progressQueries.ts` executes an `UPSERT` on `onboarding_progress`.
5. Frontend updates `onboardingStore`.

---

## Development Environment & Proxy Setup

* **Vite Proxy (`client/vite.config.ts`)**:
  ```ts
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  });
  ```
* **Scripts in Root `package.json`**:
  ```json
  {
    "name": "smart-scheduling-app",
    "private": true,
    "workspaces": ["shared", "client", "server"],
    "scripts": {
      "dev": "concurrently \"npm run dev --workspace=server\" \"npm run dev --workspace=client\"",
      "build": "npm run build --workspace=shared && npm run build --workspace=client && npm run build --workspace=server",
      "test": "npm run test --workspaces",
      "lint": "npm run lint --workspaces"
    }
  }
  ```

---

## Technology Stack (Sprint 1)

- **Monorepo**: npm workspaces + `concurrently`
- **Shared**: TypeScript + Zod
- **Frontend**: React 18 + Vite + Tailwind CSS + Zustand + React Hook Form
- **Backend**: Node.js (v20+ LTS) + Express + TypeScript + Zod
- **Database**: SQLite (WAL mode) via `better-sqlite3` in a single `app.db`
- **Auth**: Argon2 / Bcrypt + opaque session tokens / Google OAuth 2.0 readiness
- **Testing**: Vitest + Supertest (backend API) and Vitest + React Testing Library (frontend)

- **Monorepo**: npm workspaces + `concurrently`
- **Shared**: TypeScript + Zod
- **Frontend**: React 18 + Vite + Tailwind CSS + Zustand + React Hook Form
- **Backend**: Node.js (v20+ LTS) + Express + TypeScript + Zod
- **Database**: SQLite (WAL mode) via `better-sqlite3` in a single `app.db`
- **Auth**: Argon2 / Bcrypt + opaque session tokens / Google OAuth 2.0 readiness
- **Testing**: Vitest + Supertest (backend API) and Vitest + React Testing Library (frontend)

