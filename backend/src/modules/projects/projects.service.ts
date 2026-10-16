import type { Project, ProjectRole } from '@prisma/client';
import { prisma } from '../../db';
import { progressPercent } from '../../utils/progress';
import { requireAdmin, requireMember, visibleTasksWhere } from './projectAccess';

type TaskCounts = { total: number; done: number };

function toProjectResponse(project: Project, myRole: ProjectRole, memberCount: number, counts: TaskCounts) {
  return {
    ...project,
    myRole,
    memberCount,
    // Counts only include tasks this user can see (owner/admins: all; members: assigned to them).
    totalTasks: counts.total,
    doneTasks: counts.done,
    progress: progressPercent(counts.done, counts.total),
  };
}

/** Task counts per project, using one GROUP BY query (not one query per project). */
async function countVisibleTasks(userId: string, projectId?: string) {
  const rows = await prisma.task.groupBy({
    by: ['projectId', 'status'],
    where: { ...visibleTasksWhere(userId), ...(projectId && { projectId }) },
    _count: { _all: true },
  });

  const counts = new Map<string, TaskCounts>();
  for (const row of rows) {
    const entry = counts.get(row.projectId) ?? { total: 0, done: 0 };
    entry.total += row._count._all;
    if (row.status === 'DONE') entry.done += row._count._all;
    counts.set(row.projectId, entry);
  }
  return counts;
}

/** Projects the user is a member of (as admin or member). */
export async function listProjects(userId: string) {
  const [projects, counts] = await Promise.all([
    prisma.project.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
      include: {
        members: { where: { userId }, select: { role: true } },
        _count: { select: { members: true } },
      },
    }),
    countVisibleTasks(userId),
  ]);

  return projects.map(({ members, _count, ...project }) =>
    toProjectResponse(project, members[0].role, _count.members, counts.get(project.id) ?? { total: 0, done: 0 }),
  );
}

export async function getProject(userId: string, projectId: string) {
  const membership = await requireMember(userId, projectId);
  const [project, counts] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { _count: { select: { members: true } } },
    }),
    countVisibleTasks(userId, projectId),
  ]);

  const { _count, ...rest } = project;
  return toProjectResponse(rest, membership.role, _count.members, counts.get(projectId) ?? { total: 0, done: 0 });
}

/** The creator automatically becomes the project's owner. */
export async function createProject(userId: string, data: { name: string; description: string }) {
  const project = await prisma.project.create({
    data: {
      ...data,
      createdById: userId,
      members: { create: { userId, role: 'OWNER' } },
    },
  });
  return toProjectResponse(project, 'OWNER', 1, { total: 0, done: 0 });
}

export async function updateProject(
  userId: string,
  projectId: string,
  data: { name?: string; description?: string },
) {
  await requireAdmin(userId, projectId);
  await prisma.project.update({ where: { id: projectId }, data });
  return getProject(userId, projectId);
}

export async function deleteProject(userId: string, projectId: string) {
  await requireAdmin(userId, projectId);
  // Members, tasks and task history are removed by the database (ON DELETE CASCADE).
  await prisma.project.delete({ where: { id: projectId } });
}
