import { Router, Response } from 'express';
import { userQueries, UserRow } from '../db/queries/userQueries.js';
import { PreferenceSyncService } from '../services/preferenceSync.service.js';
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
    const schedulePivot = PreferenceSyncService.applyChange(
      userId,
      user,
      undefined,
      undefined,
      newPrefs,
      'PREFERENCES_FORM'
    );
    userQueries.updateUserProfile(userId, {
      preferences: JSON.stringify(newPrefs),
    });

    const updatedUser = userQueries.findUserById(userId);
    res.status(200).json({
      success: true,
      data: JSON.parse(updatedUser!.preferences || '{}'),
      meta: { schedulePivot },
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

    const schedulePivot = PreferenceSyncService.applyChange(
      userId,
      user,
      major,
      standing,
      preferences,
      'PREFERENCES_FORM'
    );

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
      meta: { schedulePivot },
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
