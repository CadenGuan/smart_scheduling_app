import { Router, Response } from 'express';
import { userQueries } from '../db/queries/userQueries.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';

const router = Router();

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.params.id;
    if (req.user?.userId !== userId) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot access another user profile.' });
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
        majorRequirementsTaken: user.major_requirements_taken ? JSON.parse(user.major_requirements_taken) : [],
        preferences: user.breaks_preference ? JSON.parse(user.breaks_preference) : [],
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  })
);

router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.params.id;
    if (req.user?.userId !== userId) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot update another user profile.' });
      return;
    }

    const { standing, major, minor, intendedMajor, preferences } = req.body;
    userQueries.updateUserProfile(userId, {
      standing,
      major,
      minor,
      intended_major: intendedMajor,
      breaks_preference: preferences ? JSON.stringify(preferences) : undefined,
    });

    const user = userQueries.findUserById(userId);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        userId: user!.user_id,
        email: user!.email,
        name: user!.name,
        standing: user!.standing,
        major: user!.major,
        minor: user!.minor,
        intendedMajor: user!.intended_major,
        updatedAt: user!.updated_at,
      },
    });
  })
);

export default router;

