import { Router, Response } from 'express';
import { userQueries, UserRow } from '../db/queries/userQueries.js';
import { calendarQueries } from '../db/queries/calendarQueries.js';
import { CalendarService, isUsingMockAgent } from '../services/calendar.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { UserPreferencesSchema, UpdateUserProfileSchema, UpdateUserProfile } from 'shared';

const router = Router();

/**
 * Validates that the authenticated user matches the target route resource
 * and that the user exists in SQLite. Returns the UserRow if authorized,
 * otherwise responds with 403 or 404 and returns null.
 */
function getAuthorizedUser(req: AuthenticatedRequest, res: Response): UserRow | null {
  const userId = req.params.id;
  if (req.user?.userId !== userId) {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
    });
    return null;
  }

  const user = userQueries.findUserById(userId);
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
    });
    return null;
  }

  return user;
}

// 1. Get User Profile (Including parsed preferences)
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = getAuthorizedUser(req, res);
    if (!user) return;

    res.status(200).json({
      success: true,
      data: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        standing: user.standing,
        major: user.major,
        minor: user.minor,
        intendedMajor: user.intended_major,
        geStatus: user.ge_status ? JSON.parse(user.ge_status) : null,
        majorRequirementsTaken: JSON.parse(user.major_requirements_taken || '[]'),
        breaksPreference: JSON.parse(user.breaks_preference || '[]'),
        preferences: JSON.parse(user.preferences || '{}'),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  })
);

// 2. Get User Preferences Only
router.get(
  '/:id/preferences',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = getAuthorizedUser(req, res);
    if (!user) return;

    const preferences = user.preferences ? JSON.parse(user.preferences) : {};
    res.status(200).json({
      success: true,
      data: preferences,
    });
  })
);

/**
 * Detects whether an incoming profile/preferences update constitutes a Macro Hard Pivot.
 * Macro Hard Pivot fields:
 * - major
 * - standing
 * - targetTerm
 * - targetCredits
 *
 * When a macro pivot occurs:
 * 1. Invalidate and clear persisted events in user_calendar_events (including resetting pinned status).
 * 2. In mock/offline mode, immediately re-run the greedy selection algorithm to generate and persist
 *    a clean fresh baseline schedule matching the new major/standing/term/credits.
 *
 * Micro Soft adjustments (preferredFreeDays, earliestStartTime, latestEndTime, maxBackToBackHours):
 * Retain persisted courses intact and re-evaluate dynamic conflict badges in place.
 */
function handleMacroHardPivotIfNeeded(
  userId: string,
  user: UserRow,
  newMajor: string | undefined,
  newStanding: string | undefined,
  newPrefs: any
): void {
  let prevPrefs: any = {};
  if (user.preferences) {
    try {
      prevPrefs = JSON.parse(user.preferences);
    } catch {
      prevPrefs = {};
    }
  }

  const standingChanged = Boolean(
    newStanding !== undefined && user.standing && newStanding !== user.standing
  );
  const majorChanged = Boolean(
    newMajor !== undefined && user.major && newMajor !== user.major
  );

  const oldTerm = prevPrefs?.targetTerm || 'Winter 2027';
  const newTerm = newPrefs?.targetTerm;
  const termChanged = Boolean(newTerm && newTerm !== oldTerm);

  const oldCredits = prevPrefs?.targetCredits ?? 15;
  const newCredits = newPrefs?.targetCredits;
  const creditsChanged = Boolean(newCredits !== undefined && newCredits !== oldCredits);

  const existingEvents = calendarQueries.getUserCalendarEvents(userId, oldTerm);
  const isInitialSetup = existingEvents.length === 0;

  const isMacroPivot = isInitialSetup || standingChanged || majorChanged || termChanged || creditsChanged;

  if (isMacroPivot) {
    // 1. Invalidate and clear all persisted schedule events and reset pinned courses (clean slate)
    calendarQueries.deleteUserCalendarEvents(userId);

    // 2. In mock / offline mode, immediately generate fresh baseline schedule matching the new macro parameters
    if (isUsingMockAgent()) {
      const mergedPrefs = { ...(prevPrefs || {}), ...(newPrefs || {}) };
      const freshPreview = CalendarService.getPreview(userId, {
        ...mergedPrefs,
        standing: newStanding || user.standing,
        major: newMajor || user.major,
      });

      const academicEvents = freshPreview.events.filter(
        (e) => e.type !== 'GOOGLE_CALENDAR_BUSY'
      );
      if (academicEvents.length > 0) {
        calendarQueries.saveUserCalendarEvents(userId, freshPreview.term, academicEvents);
      }
    }
  }
}

// 3. Update User Preferences Only
router.put(
  '/:id/preferences',
  requireAuth,
  validateBody(UserPreferencesSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = getAuthorizedUser(req, res);
    if (!user) return;

    const userId = req.params.id;
    const newPrefs = req.body;
    handleMacroHardPivotIfNeeded(userId, user, undefined, undefined, newPrefs);
    userQueries.updateUserProfile(userId, {
      preferences: JSON.stringify(newPrefs),
    });

    const updatedUser = userQueries.findUserById(userId);
    res.status(200).json({
      success: true,
      data: JSON.parse(updatedUser!.preferences || '{}'),
    });
  })
);

// 4. Update Full Profile (With Optional Nested Preferences in One Transaction)
router.put(
  '/:id',
  requireAuth,
  validateBody(UpdateUserProfileSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = getAuthorizedUser(req, res);
    if (!user) return;

    const userId = req.params.id;
    const { name, standing, major, minor, intendedMajor, preferences } =
      req.body as UpdateUserProfile;

    const validatedPreferences =
      preferences !== undefined ? JSON.stringify(preferences) : undefined;

    handleMacroHardPivotIfNeeded(userId, user, major, standing, preferences);

    userQueries.updateUserProfile(userId, {
      name,
      standing,
      major,
      minor,
      intended_major: intendedMajor,
      preferences: validatedPreferences,
    });

    const updated = userQueries.findUserById(userId);
    res.status(200).json({
      success: true,
      data: {
        userId: updated!.user_id,
        email: updated!.email,
        name: updated!.name,
        standing: updated!.standing,
        major: updated!.major,
        minor: updated!.minor,
        intendedMajor: updated!.intended_major,
        preferences: updated!.preferences ? JSON.parse(updated!.preferences) : {},
        updatedAt: updated!.updated_at,
      },
    });
  })
);

// 5. Export Profile & Preferences to JSON (Sprint 4 Priority 3 User Story)
router.get(
  '/:id/export',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = getAuthorizedUser(req, res);
    if (!user) return;

    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      profile: {
        name: user.name,
        standing: user.standing,
        major: user.major,
        minor: user.minor,
        intendedMajor: user.intended_major,
      },
      geStatus: user.ge_status ? JSON.parse(user.ge_status) : null,
      majorRequirementsTaken: JSON.parse(user.major_requirements_taken || '[]'),
      breaksPreference: JSON.parse(user.breaks_preference || '[]'),
      preferences: user.preferences ? JSON.parse(user.preferences) : {},
    };

    res.status(200).json({
      success: true,
      data: payload,
    });
  })
);

// 6. Import Profile & Preferences from JSON (Sprint 4 Priority 3 User Story)
router.post(
  '/:id/import',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = getAuthorizedUser(req, res);
    if (!user) return;

    const userId = req.params.id;
    const body = req.body || {};
    const profile = body.profile || {};
    const preferences = body.preferences || {};

    userQueries.updateUserProfile(userId, {
      name: profile.name ?? user.name,
      standing: profile.standing ?? user.standing,
      major: profile.major ?? user.major,
      minor: profile.minor ?? user.minor,
      intended_major: profile.intendedMajor ?? user.intended_major,
      preferences: JSON.stringify(preferences),
      ge_status: body.geStatus ? JSON.stringify(body.geStatus) : (user.ge_status ?? undefined),
      major_requirements_taken: body.majorRequirementsTaken
        ? JSON.stringify(body.majorRequirementsTaken)
        : (user.major_requirements_taken ?? undefined),
      breaks_preference: body.breaksPreference
        ? JSON.stringify(body.breaksPreference)
        : (user.breaks_preference ?? undefined),
    });

    const updated = userQueries.findUserById(userId);
    res.status(200).json({
      success: true,
      message: 'Profile and preferences imported successfully.',
      data: {
        userId: updated!.user_id,
        name: updated!.name,
        standing: updated!.standing,
        major: updated!.major,
        minor: updated!.minor,
        preferences: JSON.parse(updated!.preferences || '{}'),
      },
    });
  })
);

export default router;
