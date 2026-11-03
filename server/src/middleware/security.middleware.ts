import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware enforcing OWASP and industry best practices.
 * Protects against MIME-sniffing, clickjacking, XSS, and server fingerprinting.
 */
export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent browsers from MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking by denying iframe embedding
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable XSS filter in browsers that support it
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information sent in HTTP requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Enforce HTTP Strict Transport Security (HSTS)
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Content Security Policy (CSP)
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      "connect-src 'self' http://localhost:* ws://localhost:*",
      "frame-ancestors 'none'",
    ].join('; ')
  );

  // Strip Express fingerprinting
  res.removeHeader('X-Powered-By');

  next();
}
