import type { ProjectRole } from '@prisma/client';
import { prisma } from '../../db';
import { AppError, notFound } from '../../utils/AppError';
import { isManager, requireAdmin, requireMember } from './projectAccess';

// New members join through email invitations (see invitations.service.ts).

const memberSelect = {
  role: true,
  joinedAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

type MemberRow = { role: ProjectRole; joinedAt: Date; user: { id: string; name: string; email: string } };

function toMemberResponse({ role, joinedAt, user }: MemberRow) {
  return { userId: user.id, name: user.name, email: user.email, role, joinedAt };
}

async function findMember(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (!member) throw notFound('Member');
  return member;
}

/** Any member can see who is in the project. */
export async function listMembers(actorId: string, projectId: string) {
  await requireMember(actorId, projectId);
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: memberSelect,
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }], // owner, then admins, then members
  });
  return members.map(toMemberResponse);
}

/** Owner/admins make someone an admin or a member. The owner's role never changes. */
export async function changeMemberRole(actorId: string, projectId: string, userId: string, role: ProjectRole) {
  await requireAdmin(actorId, projectId);
  const member = await findMember(projectId, userId);

  if (member.role === 'OWNER') {
    throw new AppError(403, "The project owner's role can't be changed");
  }

  const updated = await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
    select: memberSelect,
  });
  return toMemberResponse(updated);
}

/** Owner/admins can remove anyone except the owner; a member or admin can remove themselves (leave). */
export async function removeMember(actorId: string, projectId: string, userId: string) {
  const actor = await requireMember(actorId, projectId);
  if (!isManager(actor.role) && actorId !== userId) {
    throw new AppError(403, 'Only project admins can remove other members');
  }

  const member = await findMember(projectId, userId);
  if (member.role === 'OWNER') {
    throw new AppError(403, "The project owner can't be removed or leave the project");
  }

  // Their tasks in this project go back to "unassigned" so the team can pick them up.
  await prisma.$transaction([
    prisma.task.updateMany({ where: { projectId, assigneeId: userId }, data: { assigneeId: null } }),
    prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } }),
  ]);
}
