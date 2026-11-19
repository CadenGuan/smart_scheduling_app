# Quickstart Guide: Interactive Calendar UI & Sync Engine

**Feature**: `specs/004-calendar-ui-sync`  
**Branch**: `task/2`  
**Date**: 2026-11-18  

---

## 1. Setup & Dependencies

### Frontend (`client/`)
Install `@fullcalendar` packages:
```bash
cd client
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/timegrid
```

### Backend (`server/`)
Run database migrations/schema updates:
```bash
cd server
npm install
npm run build
```

### Django Agent Service (`agent_service/`)
Verify Python virtual environment:
```bash
cd agent_service
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 2. Running the Development Stack

### Terminal 1: Node.js Backend Server
```bash
cd server
npm run dev
# Running on http://localhost:3000
```

### Terminal 2: Django Agent Service
```bash
cd agent_service
source .venv/bin/activate
python manage.py runserver 8000
# Running on http://localhost:8000
```

### Terminal 3: Vite React Client
```bash
cd client
npm run dev
# Running on http://localhost:5173
```

---

## 3. End-to-End Validation Scenarios

### Scenario 1: Interactive FullCalendar Display
1. Navigate to `http://localhost:5173` and log into your student account.
2. Verify that `<FullCalendar>` renders Monday–Friday from 8:00 AM to 8:00 PM.
3. Confirm that the calendar is read-only (dragging or clicking calendar slots does not create events).
4. Verify external events (`is_imported = 1`) render in gray with an `[External]` label.

### Scenario 2: Agent Schedule Mutation
1. Open the Chat with Sammy the Slug on the dashboard.
2. Ask Sammy: `"Add CSE 30 to my schedule"`.
3. Sammy verifies prerequisites using `check_course_prerequisites`, inspects sections with `get_course_sections`, and calls `create_class_event("CSE 30", "01")`.
4. The event appears immediately on the local FullCalendar with a `pending` sync badge.

### Scenario 3: Google Calendar Synchronization
1. For email/password accounts, click **"Sync to Google Calendar"** in the calendar header.
2. Complete Google OAuth consent. Upon return, `is_connected_to_google` becomes `true`.
3. The Node Sync Engine automatically picks up the pending `CSE 30` event, posts it to Django `/api/sync/push`, and updates its badge to `synced` with a Google Event ID.
4. Click **"Sync Now"** (`POST /api/sync/run`) to test manual synchronization.

---

## 4. Running the Test Suites

### Server Tests (Node / Vitest)
```bash
cd server
npm test
```

### Client Tests (Vitest)
```bash
cd client
npm test
```

### Agent Service Tests (Django / Pytest with Coverage >= 80%)
```bash
cd agent_service
.venv/bin/pytest tests/ --cov=agent --cov-report=term-missing
```
