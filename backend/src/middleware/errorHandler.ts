import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

/**
 * Every error response has the same shape:
 *   { "error": { "message": "...", "details": [...optional] } }
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  // Malformed JSON in the request body (thrown by express.json()).
  if (err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
    return;
  }

  // Unexpected: log enough to find it (which request, which user), but never send details to the client.
  console.error(
    `[${new Date().toISOString()}] 500 ${req.method} ${req.originalUrl} user=${req.userId ?? 'anonymous'}`,
    err,
  );
  res.status(500).json({ error: { message: 'Something went wrong' } });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found` } });
}
