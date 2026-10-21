# API Contract: Authentication Endpoints

Base Path: `/api/auth`

---

## 1. Register User

* **Method**: `POST`
* **Path**: `/api/auth/register`
* **Auth Required**: No

### Request Body (`application/json`)
```json
{
  "email": "student@ucsc.edu",
  "password": "Password123!",
  "name": "Sammy Slug",
  "standing": "Junior",
  "major": "Computer Science B.S."
}
```

### Response `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "d3b07384-d113-4f9e-8c65-27a3e74f8365",
      "email": "student@ucsc.edu",
      "name": "Sammy Slug",
      "standing": "Junior",
      "major": "Computer Science B.S."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "onboardingCompleted": false
  }
}
```

### Response `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "details": [
    { "path": "email", "message": "Invalid email address" },
    { "path": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

### Response `409 Conflict` (Email Already Registered)
```json
{
  "success": false,
  "error": "EMAIL_ALREADY_REGISTERED",
  "message": "An account with this email already exists."
}
```

---

## 2. Login User

* **Method**: `POST`
* **Path**: `/api/auth/login`
* **Auth Required**: No

### Request Body (`application/json`)
```json
{
  "email": "student@ucsc.edu",
  "password": "Password123!"
}
```

### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "d3b07384-d113-4f9e-8c65-27a3e74f8365",
      "email": "student@ucsc.edu",
      "name": "Sammy Slug",
      "standing": "Junior",
      "major": "Computer Science B.S."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "onboardingCompleted": false
  }
}
```

### Response `401 Unauthorized`
```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid email or password."
}
```

---

## 3. Google OAuth & Mock Login

* **Method**: `POST`
* **Path**: `/api/auth/google`
* **Auth Required**: No

### Request Body (`application/json`)
```json
{
  "idToken": "google-oauth-token-or-mock-slug-token",
  "isMock": false
}
```

### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "email": "sslug@ucsc.edu",
      "name": "Sammy Slug",
      "standing": "Junior",
      "major": "Computer Science B.S."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "googleCalendarLinked": true,
    "onboardingCompleted": false
  }
}
```

---

## 4. Logout User

* **Method**: `POST`
* **Path**: `/api/auth/logout`
* **Auth Required**: Yes (`Bearer <token>`)

### Response `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

