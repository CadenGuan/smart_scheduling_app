# Research: Interactive Calendar UI & Sync Engine

**Feature**: `specs/004-calendar-ui-sync`  
**Date**: 2026-11-18  
**Topic**: Sprint 3 Task 2 Technical Decisions & Architecture  

---

## 1. FullCalendar Integration in React 18 & Vite

### Decision
Install and integrate `@fullcalendar/react` and `@fullcalendar/timegrid` in `client/package.json`.

### Technical Details
- **View Selection**: `timeGridWeek` configured for academic week days:
  ```tsx
  <FullCalendar
    plugins={[timeGridPlugin]}
    initialView="timeGridWeek"
    headerToolbar={false} // Clean embedded look in dashboard
    slotMinTime="08:00:00"
    slotMaxTime="20:00:00"
    allDaySlot={false}
    hiddenDays={[0, 6]} // Monday through Friday (0 = Sun, 6 = Sat)
    editable={false}
    selectable={false}
    eventStartEditable={false}
    eventDurationEditable={false}
    events={mappedEvents}
    eventContent={renderEventContent}
  />
  ```
- **Recurrence Mapping**:
  UCSC courses are offered on days like `MWF` or `TuTh`. In FullCalendar, recurring weekly meetings are represented by:
  - `daysOfWeek`: Array of integers `[1, 3, 5]` (Mon=1, Tue=2, Wed=3, Thu=4, Fri=5)
  - `startTime`: 24h format `"10:00:00"`
  - `endTime`: 24h format `"11:05:00"`
  - `startRecur`: Quarter start date (e.g. `"2027-01-04"`)
  - `endRecur`: Quarter end date (e.g. `"2027-03-19"`)
- **Imported Event Styling**:
  Events with `is_imported: true` are external corporate calendar blocks. They are styled with neutral gray background (`#64748b`), lighter borders, and a badge `[External]` to clearly inform students they are unmodifiable.

---

## 2. Relational Database Schema (`server/src/db/`)

### Decision
Migrate from `user_calendar_events` to `user_schedule` and add `user_settings`.

### Schema DDL
```sql
-- Dedicated User Settings for Sync Configuration
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  sync_enabled BOOLEAN DEFAULT 1,
  is_connected_to_google BOOLEAN DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Academic Schedule & Synced Events
CREATE TABLE IF NOT EXISTS user_schedule (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  days TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_imported BOOLEAN DEFAULT 0,
  sync_status TEXT NOT NULL CHECK (sync_status IN ('pending', 'synced', 'failed')),
  google_event_id TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_schedule_user ON user_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schedule_pending ON user_schedule(user_id, sync_status, is_imported);
```

### Relational Integrity
Foreign key constraint `REFERENCES users(user_id) ON DELETE CASCADE` guarantees that no orphaned calendar event exists without a valid student account.

---

## 3. Node Sync Engine Architecture

### Decision
A resilient, asynchronous synchronization pipeline implemented in `server/src/services/syncEngine.service.ts`.

### Workflow
1. **Trigger Points**:
   - Automatic: Called after `POST /api/user_schedule` or `PUT /api/user_schedule/:id` succeeds.
   - Automatic: Called immediately upon successful Google OAuth callback (`is_connected_to_google` set to 1).
   - Manual: Student clicks "Sync Now" button, triggering `POST /api/sync/run`.
2. **Eligibility Filtering**:
   - Query: `SELECT * FROM user_schedule WHERE user_id = ? AND sync_status = 'pending' AND is_imported = 0`.
   - Checks `user_settings`: Both `sync_enabled` and `is_connected_to_google` must be true.
3. **Dispatch to Django**:
   - Fetches Google OAuth access token from `oauth_tokens` table for the user.
   - Posts each event to `http://localhost:8000/api/sync/push` with payload `{ event: row, googleToken: accessToken }`.
4. **Token Expiry & Recovery**:
   - If Django reports 401 from Google API, Node uses `oauth_tokens.refresh_token` to call `https://oauth2.googleapis.com/token`.
   - Upon successful refresh, Node updates `oauth_tokens` with the new access token and retries the sync push.
   - If refresh token is missing or revoked, Node marks `sync_status = 'failed'` and sets `is_connected_to_google = 0`.

---

## 4. Django Service & Agent Integration (`agent_service/`)

### Decision
Keep Django and Node completely decoupled; Django manages the LangGraph agent and acts as the Google push executor.

### Agent Schedule Mutation Tools
```python
@tool
def create_class_event(course_code: str, section: str = "01") -> str:
    """Creates a verified class event on the student's schedule by calling Node POST /api/user_schedule."""
    ...

@tool
def delete_class_event(course_code: str) -> str:
    """Removes a class event from the student's schedule by calling Node DELETE /api/user_schedule/:id."""
    ...
```

### Google MCP Read-Only Isolation
The agent's tool registry binds only inspection tools (`list_google_events`, `find_free_time`) to prevent the agent from writing directly to Google Calendar. All mutations go through the local database first via Node CRUD.

### Django Google Push Endpoint (`/api/sync/push`)
```python
@csrf_exempt
def push_event_to_google(request: HttpRequest) -> JsonResponse:
    # Uses googleToken to call Google Calendar API v3
    # POST https://www.googleapis.com/calendar/v3/calendars/primary/events
    # Returns {'success': True, 'google_event_id': event_id}
```
