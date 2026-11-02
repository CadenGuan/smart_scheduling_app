import { Router, Response } from 'express';
import { userQueries } from '../db/queries/userQueries.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { UserPreferencesSchema } from 'shared';

const router = Router();

// 1. Get User Profile (Including parsed preferences)
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.params.id;
    if (req.user?.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Cannot access another user profile.',
      });
      return;
    }

    const user = userQueries.findUserById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'User not found.' });
      return;
    }

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
    const userId = req.params.id;
    if (req.user?.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Cannot access another user preferences.',
      });
      return;
    }

    const user = userQueries.findUserById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'User not found.' });
      return;
    }

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
    const userId = req.params.id;
    if (req.user?.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Cannot update another user preferences.',
      });
      return;
    }

    const user = userQueries.findUserById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'User not found.' });
      return;
    }

    userQueries.updateUserProfile(userId, {
      preferences: JSON.stringify(req.body),
    });

    const updatedUser = userQueries.findUserById(userId);
    res.status(200).json({
      success: true,
      message: 'Preferences updated successfully.',
      data: JSON.parse(updatedUser!.preferences || '{}'),
    });
  })
);

// 4. Update Full Profile (With Optional Nested Preferences in One Transaction)
router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.params.id;
    if (req.user?.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Cannot update another user profile.',
      });
      return;
    }

    const user = userQueries.findUserById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'User not found.' });
      return;
    }

    const { standing, major, minor, intendedMajor, preferences } = req.body;

    let validatedPreferences: string | undefined = undefined;
    if (preferences !== undefined) {
      const parsed = UserPreferencesSchema.safeParse(preferences);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.errors.map((e) => ({
            path: `preferences.${e.path.join('.')}`,
            message: e.message,
          })),
        });
        return;
      }
      validatedPreferences = JSON.stringify(parsed.data);
    }

    userQueries.updateUserProfile(userId, {
      standing,
      major,
      minor,
      intended_major: intendedMajor,
      preferences: validatedPreferences,
    });

    const updated = userQueries.findUserById(userId);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
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

export default router;
