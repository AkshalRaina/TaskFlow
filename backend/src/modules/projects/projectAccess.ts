/**
 * Who can see and do what. Every project/task rule lives in this one file.
 *
 *   Not a member  -> the project and its tasks "don't exist" (404)
 *   MEMBER        -> sees the project and only the tasks assigned to them; can change their status and comment.
 *                    Can also create tasks for themselves (always assigned to them) and edit/delete those.
 *                    If someone @mentions them on another task, they can open it to read and comment (only).
 *   ADMIN         -> sees every task; creates, assigns, edits and deletes tasks; manages members
 *   OWNER         -> the project's creator: everything an admin can do, and can't be removed or demoted
 *
 * A member trying an admin-only action gets 403: they know the project exists, they just can't do that.
 */
import type { Prisma, ProjectRole } from '@prisma/client';
import { prisma } from '../../db';
import { AppError, notFound } from '../../utils/AppError';

/** Roles that can manage a project (its tasks, members and invitations). */
export const MANAGER_ROLES: ProjectRole[] = ['OWNER', 'ADMIN'];

export function isManager(role: ProjectRole): boolean {
  return MANAGER_ROLES.includes(role);
}

export async function requireMember(userId: string, projectId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) throw notFound('Project');
  return membership;
}

/** Owner or admin of the project, otherwise 403 (or 404 if not in the project at all). */
export async function requireAdmin(userId: string, projectId: string, message = 'Only project admins can do this') {
  const membership = await requireMember(userId, projectId);
  if (!isManager(membership.role)) {
    throw new AppError(403, message);
  }
  return membership;
}

/**
 * WHERE clause for "tasks this user is allowed to see" (their work).
 * Used for task lists, boards, project progress and dashboard counts, so the rule can't drift.
 */
export function visibleTasksWhere(userId: string): Prisma.TaskWhereInput {
  return {
    OR: [
      // Owners and admins see every task in their projects...
      { project: { members: { some: { userId, role: { in: MANAGER_ROLES } } } } },
      // ...members see the tasks assigned to them (only while they're still in the project).
      { assigneeId: userId, project: { members: { some: { userId } } } },
    ],
  };
}

/** Tasks in the user's projects where someone @mentioned them in a comment. */
export function mentionedTasksWhere(userId: string): Prisma.TaskWhereInput {
  return {
    project: { members: { some: { userId } } },
    comments: { some: { mentionedUserIds: { has: userId } } },
  };
}

/**
 * WHERE clause for "tasks this user can OPEN": the ones they can see, plus tasks they were @mentioned on.
 * A mention lets a member read and comment on a task without it becoming theirs, so this is used
 * only for opening one task (details, history, comments), never for lists or counts.
 */
export function openableTasksWhere(userId: string): Prisma.TaskWhereInput {
  return { OR: [visibleTasksWhere(userId), mentionedTasksWhere(userId)] };
}
