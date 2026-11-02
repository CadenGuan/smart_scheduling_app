# 02: Dedicated Preferences & Unified Profile API Endpoints

**What to build:**
Working backend endpoints `GET /api/users/:id/preferences` and `PUT /api/users/:id/preferences` (with strict Zod validation and auth checks), plus an enhanced `PUT /api/users/:id` endpoint that atomically persists both academic profile fields and preferences in a single transaction, verified with automated Supertest tests.

**Blocked by:** 01: Shared Schema & Database Preferences Foundation

**Status:** resolved

- [x] Implement `GET /api/users/:id/preferences` in `server/src/routes/users.routes.ts`
- [x] Implement `PUT /api/users/:id/preferences` with `validateBody(UserPreferencesSchema)`
- [x] Update `PUT /api/users/:id` to accept and persist nested `preferences` atomically
- [x] Add comprehensive Supertest suite in `server/tests/preferences.test.ts`

