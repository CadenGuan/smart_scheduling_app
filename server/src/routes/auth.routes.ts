import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { GoogleAuthService } from '../services/google.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  GoogleAuthRequestSchema,
} from 'shared';

const router = Router();

router.post(
  '/register',
  validateBody(RegisterRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.register(req.body);
    res.status(201).json({ success: true, data: result });
  })
);

router.post(
  '/login',
  validateBody(LoginRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.login(req.body);
    res.status(200).json({ success: true, data: result });
  })
);

router.post(
  '/google',
  validateBody(GoogleAuthRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { idToken, isMock } = req.body;
    const result = await GoogleAuthService.authenticate(idToken, isMock);
    res.status(200).json({ success: true, data: result });
  })
);

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const token = req.headers.authorization!.split(' ')[1];
    AuthService.logout(token);
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  })
);

export default router;

