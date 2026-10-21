# API Contract: Onboarding Progress & Calendar Preview

Base Paths: `/api/users/:id/progress` and `/api/calendar`

---

## 1. Get Onboarding Progress

* **Method**: `GET`
* **Path**: `/api/users/:id/progress`
* **Auth Required**: Yes (`Bearer <token>`)

### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "d3b07384-d113-4f9e-8c65-27a3e74f8365",
    "completed": false,
    "lastStep": 2,
    "skippedSteps": [2],
    "draftAnswers": {
      "name": "Sammy Slug",
      "standing": "Junior",
      "major": "Computer Science B.S."
    }
  }
}
```

---

## 2. Save / Update Onboarding Progress

* **Method**: `PUT`
* **Path**: `/api/users/:id/progress`
* **Auth Required**: Yes (`Bearer <token>`)

### Request Body (`application/json`)
```json
{
  "lastStep": 3,
  "skippedSteps": [2],
  "draftAnswers": {
    "name": "Sammy Slug",
    "standing": "Junior",
    "major": "Computer Science B.S.",
    "geSource": "UCSC",
    "geCategoriesRemaining": ["CC", "ER"]
  },
  "completed": false
}
```

### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "d3b07384-d113-4f9e-8c65-27a3e74f8365",
    "completed": false,
    "lastStep": 3,
    "skippedSteps": [2],
    "updatedAt": "2026-10-20T21:05:00.000Z"
  }
}
```

---

## 3. Calendar Preview Endpoints

* **Method**: `GET`
* **Path**: `/api/calendar/preview`
* **Auth Required**: Yes (`Bearer <token>`)

### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "term": "Winter 2027",
    "totalCredits": 15,
    "events": [
      {
        "id": "cse-115a-lec",
        "title": "CSE 115A: Intro to Software Engineering",
        "type": "MAJOR",
        "instructor": "Staff",
        "location": "Baskin Engr 152",
        "days": ["Monday", "Wednesday", "Friday"],
        "startTime": "09:00",
        "endTime": "10:10",
        "color": "#00B4DB"
      },
      {
        "id": "math-21-lec",
        "title": "MATH 21: Linear Algebra",
        "type": "MAJOR",
        "instructor": "Staff",
        "location": "Thimann 003",
        "days": ["Tuesday", "Thursday"],
        "startTime": "13:15",
        "endTime": "14:50",
        "color": "#00B4DB"
      },
      {
        "id": "art-10f-lec",
        "title": "ART 10F: 2D Design (PR GE)",
        "type": "GE",
        "instructor": "Staff",
        "location": "Digital Arts 101",
        "days": ["Monday", "Wednesday"],
        "startTime": "15:20",
        "endTime": "16:55",
        "color": "#FF6B6B"
      },
      {
        "id": "gcal-work-shift",
        "title": "Dining Hall Work Shift",
        "type": "GOOGLE_CALENDAR_BUSY",
        "location": "Cowell Dining Hall",
        "days": ["Tuesday", "Thursday"],
        "startTime": "10:00",
        "endTime": "12:00",
        "color": "#F9CA24"
      }
    ]
  }
}
```

