import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app } from '../src/app.js';
import { createRateLimiter, clearRateLimitStore } from '../src/middleware/rateLimiter.js';
import { securityHeadersMiddleware } from '../src/middleware/security.middleware.js';

describe('Security Hardening Test Suite (Product Backlog Item 3)', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  describe('HTTP Security Headers Middleware', () => {
    it('applies OWASP security headers to server responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-xss-protection']).toBe('1; mode=block');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('strips x-powered-by header to prevent fingerprinting', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('works standalone in custom express instance', async () => {
      const testApp = express();
      testApp.use(securityHeadersMiddleware);
      testApp.get('/test', (_req, res) => res.send('ok'));

      const res = await request(testApp).get('/test');
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('Rate Limiter Middleware', () => {
    it('attaches rate limit headers and tracks request counts', async () => {
      const testApp = express();
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 3,
        skipInTests: false,
      });

      testApp.use('/test', limiter, (_req, res) => res.json({ ok: true }));

      const res1 = await request(testApp).get('/test');
      expect(res1.status).toBe(200);
      expect(res1.headers['x-ratelimit-limit']).toBe('3');
      expect(res1.headers['x-ratelimit-remaining']).toBe('2');

      const res2 = await request(testApp).get('/test');
      expect(res2.status).toBe(200);
      expect(res2.headers['x-ratelimit-remaining']).toBe('1');

      const res3 = await request(testApp).get('/test');
      expect(res3.status).toBe(200);
      expect(res3.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('returns 429 Too Many Requests when request count exceeds threshold', async () => {
      const testApp = express();
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 2,
        message: 'Rate limit exceeded for test.',
        skipInTests: false,
      });

      testApp.use('/limited', limiter, (_req, res) => res.json({ ok: true }));

      // Requests 1 & 2 pass
      await request(testApp).get('/limited');
      await request(testApp).get('/limited');

      // Request 3 is blocked
      const blockedRes = await request(testApp).get('/limited');
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error).toBe('Rate limit exceeded for test.');
      expect(blockedRes.headers['retry-after']).toBeDefined();
    });

    it('resets rate limit counts when clearRateLimitStore is invoked', async () => {
      const testApp = express();
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 1,
        skipInTests: false,
      });

      testApp.use('/reset-test', limiter, (_req, res) => res.json({ ok: true }));

      // First request passes
      const res1 = await request(testApp).get('/reset-test');
      expect(res1.status).toBe(200);

      // Second request fails
      const res2 = await request(testApp).get('/reset-test');
      expect(res2.status).toBe(429);

      // Clear store
      clearRateLimitStore();

      // Third request passes again
      const res3 = await request(testApp).get('/reset-test');
      expect(res3.status).toBe(200);
    });

    it('integrates with /api/auth/login route with header trigger', async () => {
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 2,
        skipInTests: true,
      });

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/auth/test-login', limiter, (_req, res) => res.json({ ok: true }));

      // Without x-test-rate-limit header, tests bypass limiter
      await request(testApp).post('/api/auth/test-login').send({});
      await request(testApp).post('/api/auth/test-login').send({});
      const bypassRes = await request(testApp).post('/api/auth/test-login').send({});
      expect(bypassRes.status).toBe(200);

      // With x-test-rate-limit header, limiter enforces bounds
      clearRateLimitStore();
      await request(testApp).post('/api/auth/test-login').set('x-test-rate-limit', 'true').send({});
      await request(testApp).post('/api/auth/test-login').set('x-test-rate-limit', 'true').send({});
      const enforcedRes = await request(testApp)
        .post('/api/auth/test-login')
        .set('x-test-rate-limit', 'true')
        .send({});
      expect(enforcedRes.status).toBe(429);
    });
  });
});
