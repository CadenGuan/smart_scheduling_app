# Feature Specification: Sprint 1 MVP — Smart Scheduling App

**Feature Branch**: `001-sprint1-mvp`
**Created**: 2026-10-20
**Status**: Ready for Planning
**Input**: Requirements from `sprint1_mvp_plan.md`, `sprint1_architecture_design.md`, and `sprint1_questionnaire.md`

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Authentication & Session Security (Priority: P1)
As a student arriving at the application, I want to securely register or log in using email/password or a dual-mode Google Sign-In, so that my account and calendar preferences are securely maintained across sessions.

**Why this priority**: Authentication is foundational; every subsequent feature (onboarding persistence, profile management, calendar constraints) requires an identified, authenticated user.

**Independent Test**: Can be tested by creating an account at `/login` or clicking "Sign in with Google" (real or simulated mock), verifying that an HMAC-SHA256 signed JWT is returned and stored, and confirming that protected endpoints reject requests without a valid token.

**Acceptance Scenarios**:
1. **Given** a new student, **When** they submit valid registration details or click Google Sign-In, **Then** a new user is created in SQLite, a signed session token is issued, and they are redirected to `/onboarding`.
2. **Given** an invalid or expired token, **When** an API request is made, **Then** the server responds with HTTP 401 and the frontend AuthGuard redirects to `/login`.

---

### User Story 2 - Multi-Step Onboarding Questionnaire with Skip Logic (Priority: P2)
As a student setting up my profile, I want to answer introductory questions (standing, major/minor, GEs, course requirements taken, target quarter, unit load, break times) with the option to skip optional questions, so that I can provide my scheduling constraints at my own pace.

**Why this priority**: Captures all academic constraints needed for the future scheduling agent while providing a smooth first-time user experience.

**Independent Test**: Can be tested by navigating through steps 1 to 5, skipping optional questions (e.g. minor, break intervals), refreshing the browser, and verifying that progress and draft answers were auto-saved to SQLite and reloaded upon return.

**Acceptance Scenarios**:
1. **Given** a user on step 2, **When** they click "Skip this step", **Then** the step is marked skipped in `onboarding_progress`, draft answers are updated, and step 3 loads.
2. **Given** a user completing step 5, **When** they click "Finish Onboarding", **Then** the profile is saved as completed and they are redirected to `/dashboard`.

---

### User Story 3 - Interactive Weekly Calendar Preview (Priority: P3)
As a student who has completed onboarding, I want to view a weekly calendar preview populated with realistic UCSC course blocks and busy windows, with hover highlights and click details, so that I understand how my schedule will look.

**Why this priority**: Delivers the visual feedback loop central to the app's value proposition.

**Independent Test**: Can be tested by opening `/dashboard`, observing course blocks rendered across Monday–Friday time slots, hovering over course cards to see meeting time synchronizations, and clicking a card to open a course details modal.

**Acceptance Scenarios**:
1. **Given** the weekly calendar grid, **When** the user hovers over a course card, **Then** all corresponding lecture and lab slots highlight simultaneously.
2. **Given** a course card on the grid, **When** the user clicks it, **Then** a modal opens displaying instructor, meeting location, and course details.

---

### User Story 4 - Navigation Bar, Preferences Drawer & Agent Placeholder (Priority: P4)
As a student viewing my dashboard, I want to see the application branding, an "Edit Preferences" button in the navigation bar to tweak my settings, and a dedicated placeholder reserving space for the upcoming AI Agent.

**Why this priority**: Establishes layout ergonomics, preferences editing without leaving the view, and architecture readiness for Sprint 2.

**Independent Test**: Can be tested by clicking "Edit Preferences" in the navbar to open the slide-over drawer, modifying a constraint (e.g. break time), saving, and verifying that the agent placeholder is cleanly rendered on the left 38% of the workspace.

**Acceptance Scenarios**:
1. **Given** the dashboard view, **When** "Edit Preferences" is clicked in the navbar, **Then** a modal or slide-over drawer opens displaying the questionnaire fields for editing.
2. **Given** the dashboard layout, **When** loaded, **Then** the left panel reserves the SlugAgent Workspace with preview badges and prompt suggestions.

---

## Edge Cases

- **Session Expiration during Onboarding**: Token expires while filling out a questionnaire step; prompt user to re-authenticate and restore in-flight answers from the last auto-save.
- **Missing Google Cloud Credentials**: Application boots without `GOOGLE_CLIENT_ID` in `.env`; system gracefully activates Mock Google Sign-In with an informative toast rather than crashing.
- **Course Conflict in Sample Schedule**: Two seeded course slots overlap; calendar preview renders them side-by-side without visual truncation or layout breakage.
- **Malformed Questionnaire Input**: User sends negative units or invalid time string; Zod validation catches it on both client and server, returning structured 400 errors.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Frontend MUST be built with React 18 using typed Class components (`BaseComponent`, `BaseFormView`, `BaseCardComponent`).
- **FR-002**: Frontend components MUST implement dedicated typed `onClick` and `onHover` customization functions.
- **FR-003**: The visual styling MUST strictly use the Triadic palette: Teal (`#00B4DB`), Magenta (`#FF6B6B`), and Yellow (`#F9CA24`).
- **FR-004**: The navigation bar MUST contain space for the app logo, active quarter indicator, user profile pill, and a dedicated "Edit Preferences" trigger button.
- **FR-005**: The dashboard layout MUST reserve a dedicated 38% width panel for the AI Agent placeholder.
- **FR-006**: Backend MUST run on Node.js v20+ with Express, structured with flat `async/await` services, zero nested callbacks, and centralized error handling.
- **FR-007**: Session authentication MUST employ HMAC-SHA256 cryptographically signed tokens (JWT) validated on protected routes.
- **FR-008**: System MUST support Dual-mode Google Authentication (real OAuth 2.0 with Calendar read-only scope, plus instant Mock Google Sign-In fallback).
- **FR-009**: Onboarding questionnaire MUST support 5 modular steps with auto-save on every step transition and skippable optional questions.
- **FR-010**: All application data (users, sessions, onboarding progress, OAuth tokens) MUST persist in a single local SQLite database (`server/data/app.db`) in WAL mode.
