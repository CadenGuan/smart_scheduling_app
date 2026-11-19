# Contract: User Schedule CRUD API

**Service**: Node.js Backend (`server/`)  
**Base URL**: `/api/user_schedule`  
**Authentication**: Required (`Bearer <session_token>`)  

---

## 1. `GET /api/user_schedule`
Retrieves all schedule events for the authenticated student.

### Headers
```http
Authorization: Bearer <token>
```

### Response
- **200 OK**:
```json
{
  "success": true,
  "data": [
    {
      "id": "e4b1c2a0-8a71-4a1e-8e50-bf9d646b510a",
      "userId": "usr_12345",
      "courseCode": "CSE 30",
      "title": "Programming Abstractions: Python",
      "description": "Lecture 01 - MWF 10:00-11:05 - Classroom Unit 2",
      "days": "M,W,F",
      "startTime": "10:00",
      "endTime": "11:05",
      "startDate": "2027-01-04",
      "endDate": "2027-03-19",
      "isImported": false,
      "syncStatus": "synced",
      "googleEventId": "gcal_abc123",
      "createdAt": "2026-11-18T12:00:00Z"
    }
  ]
}
```

---

## 2. `POST /api/user_schedule`
Creates a new course event. Invoked by the Agent when the student requests adding a course. Sets `sync_status = 'pending'`.

### Request Body
```json
{
  "courseCode": "CSE 30",
  "title": "Programming Abstractions in Python",
  "description": "Lecture 01 - MWF 10:00-11:05",
  "days": "M,W,F",
  "startTime": "10:00",
  "endTime": "11:05",
  "startDate": "2027-01-04",
  "endDate": "2027-03-19",
  "isImported": false
}
```

### Response
- **201 Created**:
```json
{
  "success": true,
  "data": {
    "id": "e4b1c2a0-8a71-4a1e-8e50-bf9d646b510a",
    "userId": "usr_12345",
    "courseCode": "CSE 30",
    "title": "Programming Abstractions in Python",
    "description": "Lecture 01 - MWF 10:00-11:05",
    "days": "M,W,F",
    "startTime": "10:00",
    "endTime": "11:05",
    "startDate": "2027-01-04",
    "endDate": "2027-03-19",
    "isImported": false,
    "syncStatus": "pending",
    "googleEventId": null,
    "createdAt": "2026-11-18T12:00:00Z"
  }
}
```
- **400 Bad Request**: Validation error (missing required fields).
- **401 Unauthorized**: Missing or invalid session token.

---

## 3. `DELETE /api/user_schedule/:id`
Deletes a schedule event by ID.

### Response
- **200 OK**:
```json
{
  "success": true,
  "data": {
    "message": "Schedule event removed successfully",
    "id": "e4b1c2a0-8a71-4a1e-8e50-bf9d646b510a"
  }
}
```
- **404 Not Found**: Event ID does not exist or belongs to another user.

---

## 4. `PUT /api/user_schedule/:id`
Updates an existing schedule event. Resets `sync_status` to `'pending'`.

### Request Body
```json
{
  "title": "CSE 30 - Updated Section",
  "startTime": "11:15",
  "endTime": "12:20"
}
```

### Response
- **200 OK**:
```json
{
  "success": true,
  "data": {
    "id": "e4b1c2a0-8a71-4a1e-8e50-bf9d646b510a",
    "syncStatus": "pending"
  }
}
```
