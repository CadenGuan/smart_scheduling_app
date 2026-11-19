# Contract: Sync Engine & Google Push

**Feature**: `specs/004-calendar-ui-sync`  
**Communication**: Node.js Backend (`server/`) <-> Django Agent Service (`agent_service/`) <-> Google Calendar API  

---

## 1. `POST /api/sync/run` (Node.js Endpoint)
Manual trigger endpoint invoked when the student clicks "Sync Now" in the UI header.

### Headers
```http
Authorization: Bearer <session_token>
```

### Response
- **200 OK**:
```json
{
  "success": true,
  "data": {
    "syncedCount": 3,
    "failedCount": 0,
    "pendingCount": 0,
    "message": "Synchronization completed successfully."
  }
}
```
- **400 Bad Request**: `sync_enabled` is false in `user_settings` or Google account not linked (`is_connected_to_google` = 0).
- **401 Unauthorized**: Missing or invalid session token.

---

## 2. `POST /api/sync/push` (Django Agent Service Endpoint)
Internal HTTP endpoint in Django invoked by the Node Sync Engine to push a single pending event to Google Calendar.

### Endpoint
`POST http://localhost:8000/api/sync/push/`

### Request Body
```json
{
  "googleToken": "ya29.a0AfH6SMC...",
  "event": {
    "id": "e4b1c2a0-8a71-4a1e-8e50-bf9d646b510a",
    "courseCode": "CSE 30",
    "title": "Programming Abstractions in Python",
    "description": "Lecture 01 - MWF 10:00-11:05 - Classroom Unit 2",
    "days": "M,W,F",
    "startTime": "10:00",
    "endTime": "11:05",
    "startDate": "2027-01-04",
    "endDate": "2027-03-19"
  }
}
```

### Processing Logic
Django uses `googleToken` to create an event with Google Calendar API:
- Endpoint: `POST https://www.googleapis.com/calendar/v3/calendars/primary/events`
- Summary: `CSE 30: Programming Abstractions in Python`
- Description: `Lecture 01 - MWF 10:00-11:05 - Classroom Unit 2\nScheduled by Sammy the Slug`
- Recurrence rule (RRULE): `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20270319T235959Z`
- Start DateTime: First meeting timestamp (e.g. `2027-01-04T10:00:00`) with timeZone `'America/Los_Angeles'`.
- End DateTime: First meeting timestamp (e.g. `2027-01-04T11:05:00`).

### Response
- **200 OK**:
```json
{
  "success": true,
  "data": {
    "googleEventId": "7h493g8f38u2hd92h9"
  }
}
```
- **401 Unauthorized**: Google token expired or invalid:
```json
{
  "success": false,
  "error": "GOOGLE_TOKEN_EXPIRED",
  "message": "The provided Google OAuth access token is expired or unauthorized."
}
```
- **500 Internal Server Error**: Network or Google API communication failure.
