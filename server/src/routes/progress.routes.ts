import { Router, Response } from 'express';
import { ProgressService } from '../services/progress.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { OnboardingProgressPayloadSchema } from 'shared';

const router = Router();

router.get(
  '/:id/progress',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.params.id;
    if (req.user?.userId !== userId) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Unauthorized profile access' });
      return;
    }

    const progress = ProgressService.getProgress(userId);
    res.status(200).json({ success: true, data: progress });
  })
);

router.put(
  '/:id/progress',
  requireAuth,
  validateBody(OnboardingProgressPayloadSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.params.id;
    if (req.user?.userId !== userId) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Unauthorized profile access' });
      return;
    }

    const updated = ProgressService.saveProgress(userId, req.body);
    res.status(200).json({ success: true, data: updated });
  })
);

export default router;

