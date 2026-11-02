# Spec: Refine Edit Preference Button & Dynamic Schedule Recalculation

Status: ready-for-agent
Effort: refine-edit-preference
Created: 2026-11-01

## Problem Statement

Currently, when a student clicks the "Edit Preferences" button in the dashboard navigation bar, the modal presents only a limited set of fields (class standing, declared major, optional minor, and a credit slider). More importantly, saving those preferences does not trigger any recalculation or downstream logic on their schedule. The backend persists preferences in a legacy column, and the calendar preview continues displaying a static schedule regardless of whether the user changed their target credits, term, or schedule constraints.

Students need to easily refine their full degree and scheduling preferences (such as target term, target unit load, preferred free days, and time bounds) and immediately see the system re-evaluate and refresh their calendar preview with a best-effort conflict-free schedule and clear visual indicators when constraints cannot be fully satisfied.

## Solution

1. Provide a comprehensive, organized **Preferences Modal** on the dashboard accessible via the "Edit Preferences" button, allowing students to update their Academic Profile (Standing, Major, Minor), Quarter Planning (Target Term, Target Credits), and Time/Day Constraints (Earliest Start Time, Latest End Time, Preferred Free Days, Max Back-to-Back Hours).
2. Save both profile fields and scheduling preferences atomically via a dedicated API endpoint (`PUT /api/users/:id/preferences`) as well as the unified profile update route (`PUT /api/users/:id`), persisting a structured `preferences` JSON object in the database.
3. Automatically trigger a "pass of logic" on save: the frontend re-fetches the dynamic calendar preview (`GET /api/calendar/preview`), which evaluates the newly persisted preferences on the backend, selects courses matching the credit load and term, and renders a best-effort schedule with visual conflict badges if constraints (such as a preferred free day) are compromised.

## User Stories

1. As a student, I want to click the "Edit Preferences" button in the navigation bar, so that I can open an interactive modal to review and modify my scheduling and academic preferences without leaving the dashboard.
2. As a student, I want to edit my class standing, declared major, and minor in the modal, so that my degree information is always up to date.
3. As a student, I want to adjust my target quarter term (e.g., from Winter 2027 to Spring 2027), so that my schedule and dashboard reflect the term I am actively planning for.
4. As a student, I want to adjust my target credit load via an interactive slider (10 to 20 units), so that the schedule generator tailors the number of courses recommended.
5. As a student, I want to specify my earliest acceptable class start time and latest end time, so that the system avoids scheduling early morning or late evening courses.
6. As a student, I want to select one or more preferred free days (e.g., Friday), so that the system attempts to leave those days clear of classes.
7. As a student, I want to set a maximum limit for back-to-back class hours, so that I have breathing room between lectures.
8. As a student, I want the modal to group related fields into clean, scannable sections (Degree Profile, Quarter Capacity, Time & Day Constraints), so that I am not overwhelmed by a wall of inputs.
9. As a student, I want a single "Save Changes" button that persists all modified preferences in one atomic action, so that I do not have to save each section individually.
10. As a student, I want to see a clear loading indicator on the save button while the request is processing, so that I know my changes are being submitted.
11. As a student, I want the modal to automatically close upon a successful save, returning me directly to my updated dashboard.
12. As a student, I want the dashboard's active term indicator and credit badge in the navbar to update immediately after saving, so that my header reflects my new planning target.
13. As a student, I want the calendar preview to automatically re-fetch and recalculate immediately upon saving, so that I see the direct effect of my new preferences without manually reloading the browser.
14. As a student, I want to receive a best-effort schedule even if my preferences cannot be 100% satisfied (e.g., my required major course only meets on Friday, but I requested Friday off), so that I am never left with an empty or broken schedule grid.
15. As a student, I want any course that compromises an unachievable preference to be clearly badged on the calendar preview (e.g., "Spans preferred free day"), so that I immediately understand why that course was scheduled.
16. As a student, I want validation errors to be displayed if I enter invalid data (e.g., end time earlier than start time), so that I can correct my mistakes before submission.
17. As an API client, I want a dedicated `PUT /api/users/:id/preferences` endpoint that validates input with a strict schema and updates the database, so that preferences can be managed independently of auth or profile credentials.
18. As an API client, I want a `GET /api/users/:id/preferences` endpoint that returns the stored preferences, so that frontend components can retrieve current preferences directly.
19. As an API client, I want the `PUT /api/users/:id` endpoint to accept an optional nested `preferences` object and update both profile and preferences atomically, so that full updates can be achieved in a single round-trip.
20. As a developer, I want all preferences validated with shared type-safe schemas between frontend and backend, so that schema drift is eliminated.

## Implementation Decisions

### Modules Built and Modified
- **Shared Schemas Module**: Define `UserPreferencesSchema` and export `UserPreferences` type containing `targetTerm`, `targetCredits`, `earliestStartTime`, `latestEndTime`, `preferredFreeDays`, and `maxBackToBackHours`. Extend the existing `UserProfile` type to include an optional `preferences` field.
- **Database Layer**: Add a `preferences TEXT DEFAULT '{}'` column to the users table. Include an automatic migration/safeguard on database startup to ensure existing SQLite instances receive the column without data loss.
- **User Database Queries Module**: Update user queries to support reading and writing the structured `preferences` JSON string to the `preferences` column, deprecating the use of the legacy break preference column for general preferences.
- **User Routes & API Layer**:
  - Implement `GET /api/users/:id/preferences` requiring authentication and ownership.
  - Implement `PUT /api/users/:id/preferences` with body validation against `UserPreferencesSchema`.
  - Update `PUT /api/users/:id` to accept the nested `preferences` payload and save both profile attributes and preferences in a single database transaction.
- **Calendar & Schedule Engine Service**:
  - Update the calendar preview route handler to dynamically read the requesting user's stored preferences from the database.
  - Filter and select courses from the course pool matching the requested target term and credit count.
  - Check courses against preferred free days and time bounds; if an unachievable conflict exists, include compromise badge metadata on the calendar event object.
- **Frontend Service Client**:
  - Add `updatePreferences` and `getPreferences` methods to the user service.
  - Update `updateProfile` signature to strongly type nested preferences.
- **Preferences Modal Component**:
  - Expand form state and inputs to cover all defined preference fields (Target Term, Target Credits, Earliest/Latest times, Preferred Free Days, Max Back-to-Back Hours, plus Standing, Major, Minor).
  - Implement input sanitization and form validation.
  - Provide clear loading and error feedback.
- **Dashboard Page Component**:
  - Coordinate the save event: submit all-in-one updates, update local user state, trigger immediate re-fetch of the calendar preview endpoint, and synchronize active term and credit metrics.

## Testing Decisions

### What Makes a Good Test
Tests must verify external behavioral contracts, network responses, and visible user outcomes rather than internal private state or implementation details:
- When a user submits valid preferences through the API, the database record must be updated and subsequent retrieval must return the exact stored values.
- When invalid preferences are submitted (e.g., negative credits or malformed time formats), the API must return a 400 Bad Request with descriptive validation errors without altering stored data.
- When a user requests a calendar preview, the returned events, credit tally, and term must strictly reflect their stored preferences.
- If a user marks Friday as a preferred free day, any Friday course in the returned schedule must contain the compromise conflict badge.

### Primary Seams for Testing
1. **HTTP API Seam (Supertest against backend application)**:
   - `PUT /api/users/:id/preferences` (Validation, persistence, unauthorized access checks).
   - `GET /api/users/:id/preferences` (Retrieval of persisted preferences).
   - `PUT /api/users/:id` (Atomic composite update of profile fields and preferences).
   - `GET /api/calendar/preview` (Dynamic recalculation: credit filtering, term matching, conflict badging).
2. **Frontend Service / Store Seam**:
   - `UserService.updatePreferences` & `UserService.updateProfile` client-side API contract tests.

### Prior Art
- `server/tests/progress.test.ts` (Supertest integration tests for authenticated progress updates and calendar preview fetching).
- `server/tests/auth.test.ts` (Authentication and authorization tests).

## Out of Scope
- Direct Google Calendar two-way sync / OAuth write-back (Sprint 2 feature).
- Full autonomous conversational agent chat negotiation in the SlugAgent panel (Sprint 2 feature; currently displays informative snapshot and preview chips).
- UCSC registrar live portal synchronization or live enrollment cart submission.
- Custom course addition or instructor rating integration.

## Further Notes
- This work completes the Sprint 1 milestone for dynamic preference modification, unblocking Sprint 2's interactive SlugAgent partner which will consume these stored preferences during conversation.

