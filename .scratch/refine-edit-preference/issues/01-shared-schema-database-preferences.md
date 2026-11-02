# 01: Shared Schema & Database Preferences Foundation

**What to build:**
Type-safe `UserPreferencesSchema` exported in `shared`, updated `UserProfileSchema`, and a `preferences TEXT` column in SQLite (`users` table) with an automatic runtime migration safeguard on startup so all layers can safely read and write preferences without breaking existing records.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Define `UserPreferencesSchema` and export `UserPreferences` in `shared/src/user.schema.ts`
- [x] Export `UserPreferencesSchema` and types in `shared/src/index.ts`
- [x] Update `UserProfileSchema` to include `preferences: UserPreferencesSchema.optional()`
- [x] Update `server/src/db/schema.sql` to include `preferences TEXT DEFAULT '{}'` in `users` table definition
- [x] Implement non-destructive runtime migration check in `server/src/db/database.ts` (adding column if missing)
- [x] Update `UserRow` and `userQueries` in `server/src/db/queries/userQueries.ts` to include `preferences`
- [x] Run build and typecheck across shared and server
- [x] Verified with unit tests in `server/tests/preferences.test.ts`
