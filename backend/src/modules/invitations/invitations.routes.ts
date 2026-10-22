import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { AppError } from '../../utils/AppError';
import { getUserById } from '../auth/auth.service';
import { acceptInvitation, getInvitation } from './invitations.service';

// Links from invitation emails: /api/invitations/:token
export const invitationRoutes = Router();

// Shows the project, email, role and status (pending/expired/accepted),
// and whether an account already exists for that email

invitationRoutes.get('/:token', async (req, res) => {
  res.json(await getInvitation(req.params.token));
});

//Logged-in user accepts. Their email must match the invited email
invitationRoutes.post('/:token/accept', requireAuth, async (req, res) => {
  const user = await getUserById(req.userId);
  if (!user) throw new AppError(401, 'Account no longer exists');
  res.json(await acceptInvitation(String(req.params.token), user));
});
