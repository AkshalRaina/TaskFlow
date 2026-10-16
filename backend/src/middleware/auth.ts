import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/AppError';

export const AUTH_COOKIE = 'token';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. Only read it in routes that use that middleware. */
      userId: string;
    }
  }
}

/**
 * Reads the JWT from the httpOnly cookie and puts the user's id on `req.userId`.
 * No database lookup is needed, so this stays fast and the API stays stateless.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    throw new AppError(401, 'Authentication required');
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
    req.userId = payload.userId;
  } catch {
    throw new AppError(401, 'Your session is invalid or has expired');
  }
  next();
}
