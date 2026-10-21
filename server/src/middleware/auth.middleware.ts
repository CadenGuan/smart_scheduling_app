import { Request, Response, NextFunction } from 'express';
import { TokenService, TokenPayload } from '../services/token.service.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'MISSING_OR_MALFORMED_TOKEN',
      message: 'Authorization token is required.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = TokenService.verifyAndDecode(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'INVALID_OR_EXPIRED_TOKEN',
      message: 'The session token is invalid or has expired.',
    });
  }
};

