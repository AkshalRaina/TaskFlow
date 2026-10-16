/**
 * Email invitations to join a project.
 *
 * 1. An owner/admin invites an email address with a role (ADMIN or MEMBER).
 * 2. We create a random token, store only its SHA-256 hash, and email a link containing the token.
 * 3. The person opens the link, signs in (or registers with that email), and accepts.
 *
 * A link works once, for that email only, and expires after 24 hours.
 */
import crypto from 'node:crypto';
import type { ProjectInvitation, ProjectRole } from '@prisma/client';
import { config } from '../../config';
import { prisma } from '../../db';
import { sendEmail } from '../../email/mailer';
import { invitationEmail } from '../../email/templates';
import { AppError, notFound } from '../../utils/AppError';
import { requireAdmin } from '../projects/projectAccess';

export const INVITATION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function inviteLink(token: string): string {
  return `${config.clientUrl}/invite/${token}`;
}

type InvitationStatus = 'pending' | 'expired' | 'accepted';

function statusOf(invitation: ProjectInvitation): InvitationStatus {
  if (invitation.acceptedAt) return 'accepted';
  if (invitation.expiresAt < new Date()) return 'expired';
  return 'pending';
}

// ---------- Used by project owners/admins ----------

export async function inviteToProject(actorId: string, projectId: string, email: string, role: ProjectRole) {
  await requireAdmin(actorId, projectId, 'Only project admins can invite people');

  const alreadyMember = await prisma.projectMember.findFirst({ where: { projectId, user: { email } } });
  if (alreadyMember) {
    throw new AppError(409, 'This person is already a member of the project');
  }

  const token = crypto.randomBytes(32).toString('base64url');

  // Inviting the same email again replaces the old link (only the newest one works).
  const [, invitation] = await prisma.$transaction([
    prisma.projectInvitation.deleteMany({ where: { projectId, email, acceptedAt: null } }),
    prisma.projectInvitation.create({
      data: {
        projectId,
        email,
        role,
        tokenHash: hashToken(token),
        invitedById: actorId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      include: { project: { select: { name: true } }, invitedBy: { select: { name: true } } },
    }),
  ]);

  // The invitation is saved even if the email fails, so the admin can simply resend it.
  let emailSent = true;
  try {
    await sendEmail(
      invitationEmail({
        to: email,
        inviterName: invitation.invitedBy.name,
        projectName: invitation.project.name,
        role,
        link: inviteLink(token),
      }),
    );
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    emailSent = false;
  }

  return { invitation: toInvitationResponse(invitation), emailSent };
}

function toInvitationResponse(invitation: ProjectInvitation & { invitedBy: { name: string } }) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    invitedBy: invitation.invitedBy.name,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    status: statusOf(invitation),
  };
}

/** Invitations that haven't been accepted yet (including expired ones, so admins can resend them). */
export async function listInvitations(actorId: string, projectId: string) {
  await requireAdmin(actorId, projectId);
  const invitations = await prisma.projectInvitation.findMany({
    where: { projectId, acceptedAt: null },
    include: { invitedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return invitations.map(toInvitationResponse);
}

export async function revokeInvitation(actorId: string, projectId: string, invitationId: string) {
  await requireAdmin(actorId, projectId);
  const { count } = await prisma.projectInvitation.deleteMany({
    where: { id: invitationId, projectId, acceptedAt: null },
  });
  if (count === 0) throw notFound('Invitation');
}

// ---------- Used by the person who received the link ----------

async function findByToken(token: string) {
  const invitation = await prisma.projectInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { project: { select: { id: true, name: true } }, invitedBy: { select: { name: true } } },
  });
  if (!invitation) {
    throw new AppError(404, 'This invitation link is not valid. It may have been replaced by a newer one.');
  }
  return invitation;
}

/** Public: what the invite page shows before signing in. */
export async function getInvitation(token: string) {
  const invitation = await findByToken(token);
  const accountExists = Boolean(await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } }));

  return {
    email: invitation.email,
    role: invitation.role,
    project: { name: invitation.project.name },
    invitedBy: invitation.invitedBy.name,
    expiresAt: invitation.expiresAt,
    status: statusOf(invitation),
    accountExists,
  };
}

/**
 * Checks that the link can still be used by this email address.
 * Called before registering through a link, so a bad link doesn't leave a half-finished signup.
 */
export async function findUsableInvitation(token: string, email: string) {
  const invitation = await findByToken(token);
  const status = statusOf(invitation);

  if (status === 'accepted') throw new AppError(409, 'This invitation has already been used');
  if (status === 'expired') {
    throw new AppError(410, `This invitation has expired. Ask ${invitation.invitedBy.name} to send a new one.`);
  }
  if (invitation.email !== email.toLowerCase()) {
    throw new AppError(403, `This invitation was sent to ${invitation.email}. Sign in with that email to accept it.`);
  }
  return invitation;
}

/** Joins the project and marks the link as used, together. */
export async function acceptInvitation(token: string, user: { id: string; email: string }) {
  const invitation = await findUsableInvitation(token, user.email);

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: invitation.projectId, userId: user.id } },
  });

  await prisma.$transaction([
    ...(existing
      ? []
      : [prisma.projectMember.create({ data: { projectId: invitation.projectId, userId: user.id, role: invitation.role } })]),
    prisma.projectInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
  ]);

  return { project: invitation.project, role: existing?.role ?? invitation.role };
}
