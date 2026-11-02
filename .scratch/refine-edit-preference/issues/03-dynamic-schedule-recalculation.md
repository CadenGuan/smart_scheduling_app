# 03: Dynamic Schedule Recalculation & Conflict Badging Engine

**What to build:**
`GET /api/calendar/preview` dynamically inspects the authenticated user's stored preferences to select courses matching their `targetCredits` and `targetTerm`. When constraints cannot be 100% satisfied (e.g. user selects Friday as a free day but a required course meets Friday), it returns a best-effort schedule with visual compromise badge metadata (`Spans preferred free day`).

**Blocked by:** 01: Shared Schema & Database Preferences Foundation, 02: Dedicated Preferences & Unified Profile API Endpoints

**Status:** ready-for-agent

- [ ] Update `server/src/routes/calendar.routes.ts` to inspect user preferences from database
- [ ] Implement course pool selection matching target credits and term
- [ ] Evaluate preferred free day and time constraints against scheduled meetings
- [ ] Attach `conflictBadge` to calendar events when constraints are compromised
- [ ] Verify with tests in `server/tests/preferences.test.ts`
