import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;

  if (err instanceof ZodError || err.name === 'ZodError' || Array.isArray((err as any).issues)) {
    const issues = (err as any).issues || (err as any).errors || [];
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      details: issues.map((e: any) => ({
        path: Array.isArray(e.path) ? e.path.join('.') : String(e.path ?? ''),
        message: e.message,
      })),
    });
    return;
  }

  res.status(statusCode).json({
    success: false,
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
  });
};
