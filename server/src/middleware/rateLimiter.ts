import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipInTests?: boolean;
}

/**
 * In-memory sliding-window rate limiter middleware.
 * Defends against brute-force password guessing, credential stuffing, and DoS attacks.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests. Please try again later.',
    skipInTests = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip in test runs unless the request explicitly enables testing rate limits
    if (skipInTests && process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000).toString());
      return next();
    }

    record.count++;
    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      res.status(429).json({
        success: false,
        error: message,
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    return next();
  };
}

/**
 * Resets the in-memory rate limiter state. Used for unit tests.
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
