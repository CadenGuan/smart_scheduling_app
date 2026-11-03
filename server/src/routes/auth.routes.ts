import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { GoogleAuthService } from '../services/google.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  GoogleAuthRequestSchema,
  GoogleCodeRequestSchema,
} from 'shared';

const router = Router();

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many authentication attempts. Please try again later.',
  skipInTests: true,
});

router.post(
  '/register',
  authRateLimiter,
  validateBody(RegisterRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.register(req.body);
    res.status(201).json({ success: true, data: result });
  })
);

router.post(
  '/login',
  authRateLimiter,
  validateBody(LoginRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.login(req.body);
    res.status(200).json({ success: true, data: result });
  })
);

router.get(
  '/google/url',
  asyncHandler(async (_req: Request, res: Response) => {
    const authUrlData = GoogleAuthService.getAuthUrl();
    res.status(200).json({ success: true, data: authUrlData });
  })
);

router.post(
  '/google/code',
  validateBody(GoogleCodeRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body;
    const result = await GoogleAuthService.exchangeCode(code);
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
