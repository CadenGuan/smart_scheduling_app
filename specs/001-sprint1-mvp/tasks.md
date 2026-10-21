# Tasks: Sprint 1 MVP — Smart Scheduling App

**Input**: Design documents from `specs/001-sprint1-mvp/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)

---

## Phase 1: Setup (Shared Monorepo Infrastructure)

**Purpose**: Initialize monorepo workspace, TypeScript configs, and package boundaries.

- [X] T001 Initialize root monorepo `package.json` with npm workspaces (`shared`, `client`, `server`) and concurrent scripts in `package.json`
- [X] T002 [P] Create shared TypeScript base config in `tsconfig.base.json`
- [X] T003 [P] Initialize `shared/` package with `shared/package.json` and `shared/tsconfig.json`
- [X] T004 [P] Initialize `server/` package with `server/package.json` and `server/tsconfig.json`
- [X] T005 [P] Initialize `client/` package with `client/package.json`, `client/tsconfig.json`, and `client/vite.config.ts` (with `/api` proxy to port 3001)
- [X] T006 Configure Tailwind CSS with Triadic theme (`#00B4DB` Teal, `#FF6B6B` Magenta, `#F9CA24` Yellow) in `client/tailwind.config.js` and `client/src/index.css`
- [X] T007 [P] Create `.gitignore` at repository root covering `node_modules/`, `dist/`, `server/data/*.db`, and `.env` in `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data schemas, database initialization, error handling, and React Class component base classes.

- [X] T008 [P] Define shared Zod contracts and types for Auth, User, and Standing in `shared/src/auth.schema.ts` and `shared/src/user.schema.ts`
- [X] T009 [P] Define shared 5-step Questionnaire Zod schema with field constraints in `shared/src/onboarding.schema.ts`
- [X] T010 [P] Define shared Calendar Event and Schedule schemas in `shared/src/calendar.schema.ts`
- [X] T011 Export all shared schemas from `shared/src/index.ts` and build shared package
- [X] T012 Initialize SQLite connection manager with WAL mode and foreign keys enabled in `server/src/db/database.ts`
- [X] T013 Create database DDL schema executing `CREATE TABLE` for `users`, `sessions`, `onboarding_progress`, and `oauth_tokens` in `server/src/db/schema.sql`
- [X] T014 Implement environment configuration loader in `server/src/config.ts`
- [X] T015 [P] Implement flat async error handler middleware (`asyncHandler` and `errorHandler`) in `server/src/middleware/asyncHandler.ts` and `server/src/middleware/errorHandler.ts`
- [X] T016 [P] Implement cryptographic HMAC-SHA256 JWT service in `server/src/services/token.service.ts`
- [X] T017 [P] Implement `requireAuth` bearer token verification middleware in `server/src/middleware/auth.middleware.ts`
- [X] T018 Implement Express bootstrap with JSON parser, CORS, and route mounting in `server/src/app.ts` and `server/src/index.ts`
- [X] T019 [P] Implement abstract React Class base components `BaseComponent`, `BaseFormView`, and `BaseCardComponent` in `client/src/components/base/BaseComponent.tsx`, `client/src/components/base/BaseFormView.tsx`, and `client/src/components/base/BaseCardComponent.tsx`
- [X] T020 [P] Implement `withRouter` Higher-Order Component for React Router v6 in `client/src/utils/withRouter.tsx`
- [X] T021 Implement API client with Bearer token interceptor and relative `/api` paths in `client/src/services/apiClient.ts`

---

## Phase 3: User Story 1 - Authentication & Session Security (Priority: P1) 🎯 MVP

**Goal**: Deliver secure registration, login, logout, and dual-mode Google Sign-In with cryptographic JWT session management.

### Implementation for User Story 1
- [X] T022 [US1] Implement user repository queries (`createUser`, `findUserByEmail`, `findUserById`) in `server/src/db/queries/userQueries.ts`
- [X] T023 [US1] Implement session repository queries (`createSession`, `findSessionByToken`, `deleteSession`) in `server/src/db/queries/sessionQueries.ts`
- [X] T024 [US1] Implement password hashing and authentication service in `server/src/services/auth.service.ts`
- [X] T025 [US1] Implement Google OAuth service with dual-mode dev mock fallback in `server/src/services/google.service.ts`
- [X] T026 [US1] Implement auth routes (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/google`) in `server/src/routes/auth.routes.ts`
- [X] T027 [US1] Implement client authentication service in `client/src/services/authService.ts`
- [X] T028 [US1] Implement Zustand `authStore` managing session token and user profile in `client/src/store/authStore.ts`
- [X] T029 [US1] Implement `LoginPage` and `SignupPage` Class components with email/password form and Google Sign-In button in `client/src/pages/LoginPage.tsx`
- [X] T030 [US1] Implement `AuthGuard` route protection wrapper redirecting unauthenticated users in `client/src/components/base/AuthGuard.tsx`

---

## Phase 4: User Story 2 - Multi-Step Onboarding Questionnaire (Priority: P2)

**Goal**: Deliver a 5-step onboarding questionnaire with auto-save on every step transition and skippable optional questions.

### Implementation for User Story 2
- [X] T031 [US2] Implement onboarding progress queries (`getProgress`, `upsertProgress`, `completeOnboarding`) in `server/src/db/queries/progressQueries.ts`
- [X] T032 [US2] Implement progress service handling draft answers and skip arrays in `server/src/services/progress.service.ts`
- [X] T033 [US2] Implement progress API routes (`GET /api/users/:id/progress`, `PUT /api/users/:id/progress`) in `server/src/routes/progress.routes.ts`
- [X] T034 [US2] Implement user profile API routes (`GET /api/users/:id`, `PUT /api/users/:id`) in `server/src/routes/users.routes.ts`
- [X] T035 [US2] Implement client progress and user services in `client/src/services/progressService.ts` and `client/src/services/userService.ts`
- [X] T036 [US2] Implement step indicator progress bar Class component in `client/src/components/onboarding/StepIndicators.tsx`
- [X] T037 [US2] Implement modular step views (Step 1: Profile, Step 2: Major Reqs, Step 3: GEs, Step 4: Quarter/Units, Step 5: Preferences) in `client/src/components/onboarding/steps/`
- [X] T038 [US2] Implement `OnboardingWizard` Class component with `handleStepNext`, `handleStepSkip`, and auto-save in `client/src/pages/OnboardingPage.tsx`

---

## Phase 5: User Story 3 - Interactive Weekly Calendar Preview (Priority: P3)

**Goal**: Deliver a weekly time-grid calendar preview populated with realistic UCSC course blocks and busy windows, with hover highlights and click details.

### Implementation for User Story 3
- [X] T039 [US3] Create sample UCSC course catalog seeder (`CSE 115A`, `MATH 21`, `ART 10F`, and Work shift) in `server/src/db/seed.ts`
- [X] T040 [US3] Implement calendar preview endpoint `GET /api/calendar/preview` in `server/src/routes/calendar.routes.ts`
- [X] T041 [US3] Implement `CourseCardComponent` Class component with custom `onMouseEnter`, `onMouseLeave`, and `onClick` handlers in `client/src/components/dashboard/CourseCard.tsx`
- [X] T042 [US3] Implement `CalendarPreview` Class component rendering Monday–Friday 8 AM–8 PM grid in `client/src/components/dashboard/CalendarPreview.tsx`
- [X] T043 [US3] Implement `CourseDetailsModal` popup Class component triggered on course card click in `client/src/components/dashboard/CourseDetailsModal.tsx`

---

## Phase 6: User Story 4 - Navigation Bar, Preferences Drawer & Agent Placeholder (Priority: P4)

**Goal**: Deliver the split-view dashboard layout with SlugAgent Workspace placeholder and navbar preferences editor.

### Implementation for User Story 4
- [X] T044 [US4] Implement top `Navbar` Class component with logo branding, active term selector, "Edit Preferences" button, and user logout in `client/src/components/layout/Navbar.tsx`
- [X] T045 [US4] Implement `PreferencesModal` slide-over drawer Class component for updating settings without leaving the view in `client/src/components/layout/PreferencesModal.tsx`
- [X] T046 [US4] Implement `AgentPlaceholder` Class component reserving the left 38% width workspace with prompt chips and Sprint 2 preview badge in `client/src/components/dashboard/AgentPlaceholder.tsx`
- [X] T047 [US4] Implement `DashboardView` Class component assembling `Navbar`, `AgentPlaceholder`, and `CalendarPreview` in `client/src/pages/DashboardPage.tsx`
- [X] T048 [US4] Wire routes (`/login`, `/onboarding`, `/dashboard`) inside root `App` Class component in `client/src/App.tsx` and mount in `client/src/main.tsx`

---

## Phase 7: Polish & Verification

**Purpose**: Automated testing, environment scripts, and end-to-end verification.

- [X] T049 [P] Write integration tests for registration, login, and JWT validation in `server/tests/auth.test.ts`
- [X] T050 [P] Write integration tests for onboarding auto-save and skip logic in `server/tests/progress.test.ts`
- [X] T051 Create `server/.env.example` template with JWT secret and optional Google OAuth keys in `server/.env.example`
- [X] T052 Execute end-to-end quickstart scenarios from `specs/001-sprint1-mvp/quickstart.md` and verify all tests pass
