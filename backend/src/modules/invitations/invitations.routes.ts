import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { AppError } from '../../utils/AppError';
import { getUserById } from '../auth/auth.service';
import { acceptInvitation, getInvitation } from './invitations.service';

// Links from invitation emails: /api/invitations/:token
export const invitationRoutes = Router();

// Public: the invite page shows which project and email the link is for.
invitationRoutes.get('/:token', async (req, res) => {
  res.json(await getInvitation(req.params.token));
});

// Signed-in user accepts the invitation (their email must match the invited email).
invitationRoutes.post('/:token/accept', requireAuth, async (req, res) => {
  const user = await getUserById(req.userId);
  if (!user) throw new AppError(401, 'Account no longer exists');
  res.json(await acceptInvitation(String(req.params.token), user));
});
