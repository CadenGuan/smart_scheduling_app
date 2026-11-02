# 05: Dashboard Integration & Real-Time Schedule Update

**What to build:**
End-to-end integration on the dashboard: saving the modal atomically persists the preferences, triggers an immediate re-fetch of `/api/calendar/preview`, updates the Navbar active term and credit metrics, updates the Sammy Slug profile card, and renders compromise conflict badges directly on calendar event cards.

**Blocked by:** 03: Dynamic Schedule Recalculation & Conflict Badging Engine, 04: Frontend Client Service & Refined Preferences Modal UI

**Status:** resolved

- [x] Connect `PreferencesModal` save handler in `client/src/pages/DashboardPage.tsx`
- [x] Implement immediate re-fetch of `/api/calendar/preview` upon save
- [x] Synchronize Navbar active term and total credits state
- [x] Render compromise conflict badges in `client/src/components/dashboard/CourseCard.tsx` / `CalendarPreview.tsx`
- [x] Verify full end-to-end flow manually and in browser

