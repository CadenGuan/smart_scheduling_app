# API Contract: User Profile Endpoints

Base Path: `/api/users`

---

## 1. Get User Profile

* **Method**: `GET`
* **Path**: `/api/users/:id`
* **Auth Required**: Yes (`Bearer <token>`)

### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "d3b07384-d113-4f9e-8c65-27a3e74f8365",
    "email": "student@ucsc.edu",
    "name": "Sammy Slug",
    "standing": "Junior",
    "major": "Computer Science B.S.",
    "minor": "Bioinformatics",
    "intendedMajor": null,
    "geStatus": {
      "source": "UCSC",
      "categoriesRemaining": ["CC", "TA"]
    },
    "majorRequirementsTaken": ["CSE 12", "CSE 13S", "CSE 16", "MATH 19A", "MATH 19B"],
    "preferences": {
      "targetTerm": "Winter 2027",
      "targetCredits": 15,
      "targetCourseCount": 3,
      "earliestStartTime": "09:00",
      "latestEndTime": "18:00",
      "preferredFreeDays": ["Friday"],
      "scheduledBreaks": [
        {
          "label": "Lunch",
          "days": ["Monday", "Wednesday", "Friday"],
          "startTime": "12:00",
          "endTime": "13:00"
        }
      ]
    }
  }
}
```

### Response `403 Forbidden`
```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Cannot access another user's profile."
}
```

---

## 2. Update User Profile

* **Method**: `PUT`
* **Path**: `/api/users/:id`
* **Auth Required**: Yes (`Bearer <token>`)

### Request Body (`application/json`)
```json
{
  "standing": "Senior",
  "major": "Computer Science B.S.",
  "minor": null,
  "preferences": {
    "targetTerm": "Spring 2027",
    "targetCredits": 19,
    "targetCourseCount": 4
  }
}
```

### Response `200 OK`
```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "data": { ... }
}
```

