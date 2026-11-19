# Feature Specification: Interactive Calendar UI & Sync Engine

**Feature Branch**: `task/2`  
**Created**: 2026-11-18  
**Status**: Ready  
**Input**: Sprint 3 Task 2 (`docs/tasks/sprint-3/2.md`)

---

## 1. Problem Statement

The scheduling app currently uses a custom placeholder calendar grid and lacks integration with Google Calendar and automated schedule synchronization. Furthermore, calendar events must be managed strictly through academic advising interactions rather than direct user drag-and-drop or manual creation, guaranteeing that student schedules remain grounded in verified degree requirements and course offerings.

To fulfill Sprint 3 Task 2, the system requires:
1. **Interactive FullCalendar UI**: Replacing the placeholder calendar with `@fullcalendar/react` in `timeGridWeek` view, operating in a local-first read-only mode where events are populated from the local database.
2. **Production-Grade Relational Schema**: Adding `user_settings` for sync preferences and migrating to `user_schedule` with multi-user isolation, sync statuses (`pending`, `synced`, `failed`), and external imported flags.
3. **Agent Mutation Tools & Strict Google MCP Read-Only Isolation**: Permitting the LangGraph/LangChain agent to mutate schedules solely by hitting Node's `POST /api/user_schedule` and `DELETE /api/user_schedule/:id` endpoints via authenticated session forwarding, while strictly confining Google MCP capabilities to read-only tools (`list_events`, `find_free_time`).
4. **Node CRUD & Asynchronous Sync Engine**: Providing local CRUD endpoints in Node and an asynchronous sync pipeline that pushes pending local courses to Django's `/api/sync/push` endpoint using the user's Google OAuth token.
5. **Fail-Safe & Offline-First Guarantees**: Protecting external calendar events (`is_imported = 1`), persisting unsynced local events if disconnected, and recovering gracefully from token expiry via refresh tokens.

---

## 2. User Scenarios & Testing

### User Story 1 - Interactive Local-First FullCalendar Display (Priority: P1) 🎯 MVP

As a student, I want to see my weekly academic schedule rendered in an interactive FullCalendar view, so that I can inspect my lectures and discussions across Monday through Friday with clear visual organization.

- **Why this priority**: The primary UI interface for the application; students must visualize their schedule cleanly.
- **Independent Test**: Loading the dashboard displays `<FullCalendar>` rendering weekly courses with correct `daysOfWeek` (e.g. `[1, 3, 5]` for MWF) and start/end time slots.
- **Acceptance Scenarios**:
  1. **Given** course records in `user_schedule`, **When** the dashboard mounts, **Then** React fetches `GET /api/user_schedule` and renders courses as recurring weekly events on FullCalendar (`timeGridWeek`, 8:00 AM - 8:00 PM).
  2. **Given** imported external corporate calendar events (`is_imported = 1`), **When** displayed on FullCalendar, **Then** they render in a distinct neutral/gray visual style to indicate they cannot be modified.
  3. **Given** the user views the calendar, **When** attempting to drag, resize, or click to add events, **Then** no modifications occur (`editable={false}`, `selectable={false}`).

---

### User Story 2 - Agent-Controlled Schedule Mutations (Priority: P1)

As a student interacting with Sammy the Slug, I want the agent to add and remove verified classes from my schedule (e.g. "Add CSE 30 section 01 to my schedule"), so that my schedule changes are automatically validated against prerequisites and offerings.

- **Why this priority**: Enforces the architectural rule that only the agent mutates the local schedule.
- **Independent Test**: Invoking the agent tool `create_class_event("CSE 30", "01")` executes an HTTP call to Node `POST /api/user_schedule`, inserting a row with `sync_status = 'pending'`.
- **Acceptance Scenarios**:
  1. **Given** a user requesting class addition in chat, **When** the agent decides to add the course, **Then** it invokes `create_class_event(course_code, section)` which hits Node `POST /api/user_schedule` with Bearer user session token.
  2. **Given** a user requesting class removal in chat, **When** the agent invokes `delete_class_event(course_code)`, **Then** it hits Node `DELETE /api/user_schedule/:id`.
  3. **Given** the Google MCP server configuration, **When** tools are bound to the agent, **Then** write tools (`create_event`, `update_event`, `delete_event`) are explicitly excluded and absent from the agent's callable tools.

---

### User Story 3 - Production Database Schema & Node CRUD API (Priority: P1)

As a backend service, I need structured relational tables `user_settings` and `user_schedule` and dedicated CRUD endpoints, so that multiple students can maintain isolated, durable schedules with tracked synchronization states.

- **Why this priority**: Required data foundation for multi-user support, local persistence, and sync tracking.
- **Independent Test**: Calling Node CRUD endpoints (`GET`, `POST`, `PUT`, `DELETE` at `/api/user_schedule`) persists and modifies rows in `user_schedule` with enforced foreign keys to `users(user_id)`.
- **Acceptance Scenarios**:
  1. **Given** a request to `POST /api/user_schedule`, **When** inserted into SQLite, **Then** `sync_status` defaults to `'pending'`, `is_imported` defaults to `0`, and a unique `id` is generated.
  2. **Given** a request to insert an event without a valid `user_id`, **When** executed, **Then** the database rejects the insert due to foreign key constraints.
  3. **Given** `user_settings`, **When** queried for a user, **Then** it tracks `sync_enabled` (default `1`) and `is_connected_to_google` (default `0`).

---

### User Story 4 - Asynchronous Sync Engine & Google Push (Priority: P2)

As a student with a linked Google account, I want my scheduled UCSC classes to be synchronized to my primary Google Calendar, so that I can see my university courses alongside my personal commitments on my mobile devices.

- **Why this priority**: Bridges the local schedule to the student's external calendar ecosystem.
- **Independent Test**: Triggering the Sync Engine queries pending non-imported rows, posts them to Django `/api/sync/push` with the OAuth token, receives `google_event_id`, and updates `sync_status = 'synced'`.
- **Acceptance Scenarios**:
  1. **Given** pending events in `user_schedule` with `sync_enabled = 1` and `is_connected_to_google = 1`, **When** the sync engine triggers, **Then** Node calls Django `POST /api/sync/push` with event details and Google OAuth token.
  2. **Given** Django `/api/sync/push`, **When** invoked with a valid OAuth token, **Then** it executes a Google Calendar API insert, returning the generated `google_event_id`.
  3. **Given** a successful Google push, **When** Node receives the response, **Then** it updates `sync_status = 'synced'` and records `google_event_id`.
  4. **Given** `is_imported = 1` on an event, **When** the sync engine runs, **Then** the event is strictly ignored and never pushed to Google Calendar.

---

### User Story 5 - Authentication Handshake & Fail-Safe Recovery (Priority: P2)

As a student, I want to connect or disconnect Google Calendar easily and be protected if my credentials expire, so that I never lose my scheduled courses during network failures or authorization expiration.

- **Why this priority**: Ensures robustness, data durability, and clear user recovery paths.
- **Independent Test**: If Django receives a 401 Unauthorized from Google API, Node initiates a refresh token exchange; if that fails, `sync_status` transitions to `'failed'` without deleting the local event.
- **Acceptance Scenarios**:
  1. **Given** an email/password user, **When** they click "Sync to Google Calendar", **Then** the app initiates Google OAuth consent; upon completion, `is_connected_to_google` becomes `1` and pending sync begins.
  2. **Given** a Google token expiration during sync push, **When** a 401 error occurs, **Then** Node attempts to exchange `refresh_token` for a fresh access token and retries.
  3. **Given** an unrecoverable auth error or network offline state, **When** sync fails, **Then** local events remain in `user_schedule` with `sync_status = 'failed'` (or `'pending'`) and an alert is surfaced to the user.

---

## 3. Edge Cases & Constraints

1. **Offline Mode**: If the user has no internet access or Google APIs are unreachable, the student can still chat with the agent and add courses; rows are stored locally in SQLite with `sync_status = 'pending'` and will synchronize when connection is restored.
2. **External Corporate/Imported Events**: Events imported from external Google calendars (`is_imported = 1`) are rendered in gray on FullCalendar and strictly filtered out of the Sync Engine (`WHERE is_imported = 0`) to prevent duplicate reflection loops.
3. **User Paused Sync (`sync_enabled = 0`)**: If the user toggles sync off in settings, pending events remain queued in `user_schedule` with `sync_status = 'pending'` until sync is re-enabled.
4. **Token Expiry**: Google access tokens expire after 1 hour. The sync pipeline must catch 401 responses and leverage the OAuth `refresh_token` before marking any sync item as failed.
5. **Database Isolation**: The Django service MUST NOT directly access or query Node's `data/app.db` file. All tokens and event payloads are passed over HTTP REST APIs.

---

## 4. Requirements Matrix

| ID | Category | Requirement Description |
|---|---|---|
| **FR-001** | Frontend | Install and integrate `@fullcalendar/react` and `@fullcalendar/timegrid` in `client/`. |
| **FR-002** | Frontend | Replace custom grid in `CalendarPreview.tsx` with `<FullCalendar>` in `timeGridWeek` view (Mon–Fri, 8 AM–8 PM). |
| **FR-003** | Frontend | Set FullCalendar properties `editable={false}` and `selectable={false}` to enforce agent-only mutations. |
| **FR-004** | Frontend | Map SQLite `days` (e.g. `MWF` / `TuTh`) to FullCalendar recurring format (`daysOfWeek: [1, 3, 5]`, `startTime`, `endTime`, `startRecur`, `endRecur`). |
| **FR-005** | Frontend | Visually style imported external events (`is_imported = 1`) in gray and display sync status badges (`pending`, `synced`, `failed`). |
| **FR-006** | Frontend | Render "Sync to Google Calendar" button for unlinked accounts and "Sync Now" button for connected accounts. |
| **FR-007** | Database | Create `user_settings` table (`user_id`, `sync_enabled`, `is_connected_to_google`) with foreign key to `users`. |
| **FR-008** | Database | Create `user_schedule` table (`id`, `user_id`, `course_code`, `title`, `description`, `days`, `start_time`, `end_time`, `start_date`, `end_date`, `is_imported`, `sync_status`, `google_event_id`, `created_at`). |
| **FR-009** | Database | Enforce foreign key constraints preventing any `user_schedule` record from existing without a valid `user_id`. |
| **FR-010** | Backend API | Implement Node REST routes: `GET /api/user_schedule`, `POST /api/user_schedule`, `DELETE /api/user_schedule/:id`, `PUT /api/user_schedule/:id`. |
| **FR-011** | Backend Sync | Implement Node Sync Engine querying `sync_status = 'pending' AND is_imported = 0`, validating user settings, and forwarding events to Django `/api/sync/push`. |
| **FR-012** | Backend Sync | Implement manual sync trigger endpoint `POST /api/sync/run`. |
| **FR-013** | Backend Sync | Implement automatic token refresh upon Google 401 responses using stored `refresh_token`. |
| **FR-014** | Agent Service | Implement Django `@tool` `create_class_event(course_code, section)` that calls Node `POST /api/user_schedule`. |
| **FR-015** | Agent Service | Implement Django `@tool` `delete_class_event(course_code)` that calls Node `DELETE /api/user_schedule/:id`. |
| **FR-016** | Agent Service | Configure LangGraph/LangChain agent with strictly read-only Google MCP tools (`list_events`, `find_free_time`), excluding mutation tools. |
| **FR-017** | Agent Service | Implement Django endpoint `POST /api/sync/push` that uses Google Calendar REST API with passed Bearer token to insert events and return `google_event_id`. |
| **FR-018** | Security | Enforce database isolation: Django service must never read or write Node's SQLite database directly. |
