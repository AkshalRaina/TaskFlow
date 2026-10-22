import { Router, type CookieOptions } from 'express';
import { config } from '../../config';
import { AUTH_COOKIE, requireAuth } from '../../middleware/auth';
import { AppError } from '../../utils/AppError';
import { acceptInvitation, findUsableInvitation } from '../invitations/invitations.service';
import { loginSchema, registerSchema } from './auth.schemas';
import { createToken, getUserById, loginUser, registerUser, TOKEN_TTL_SECONDS } from './auth.service';

export const authRoutes = Router();

// httpOnly: JavaScript in the browser can't read the token, so an XSS bug can't steal it.
// sameSite=lax: the browser won't send it on cross-site form posts (basic CSRF protection).
const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/',
};

//Creates the account (bcrypt hash) and sets the JWT cookie. If an inviteToken is sent, it also joins that project
authRoutes.post('/register', async (req, res) => {
  const { name, email, password, inviteToken } = registerSchema.parse(req.body);

  // Check the invitation BEFORE creating the account, so a bad/expired link doesn't leave a half-done signup.
  if (inviteToken) await findUsableInvitation(inviteToken, email);

  const user = await registerUser(name, email, password);
  const joinedProject = inviteToken ? await acceptInvitation(inviteToken, user) : null;

  res.cookie(AUTH_COOKIE, createToken(user.id), { ...cookieOptions, maxAge: TOKEN_TTL_SECONDS * 1000 });
  res.status(201).json({ ...user, joinedProject });
});

//Checks the password and sets the JWT cookie
authRoutes.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await loginUser(email, password);

  res.cookie(AUTH_COOKIE, createToken(user.id), { ...cookieOptions, maxAge: TOKEN_TTL_SECONDS * 1000 });
  res.json(user);
});

//Clears the cookie
authRoutes.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
  res.status(204).end();
});

//Returns the current user, or 401 if the account was deleted
authRoutes.get('/me', requireAuth, async (req, res) => {
  const user = await getUserById(req.userId);
  if (!user) {
    throw new AppError(401, 'Account no longer exists');
  }
  res.json(user);
});
