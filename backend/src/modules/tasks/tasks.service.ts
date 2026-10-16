import type { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import { AppError, notFound } from '../../utils/AppError';
import { daysFromToday, DUE_SOON_DAYS } from '../../utils/dates';
import { isManager, openableTasksWhere, requireMember, visibleTasksWhere } from '../projects/projectAccess';
import { diffTask } from './taskHistory';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from './tasks.schemas';

// Related names the UI shows on every task.
export const taskInclude = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

/** A task the user is allowed to open (theirs, or one they were @mentioned on), or 404. */
export async function findOpenableTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...openableTasksWhere(userId) },
    include: taskInclude,
  });
  if (!task) throw notFound('Task');
  return task;
}

/** The assignee must be a member of the task's project. Returns their name (for the history). */
async function checkAssignee(projectId: string, assigneeId: string | null) {
  if (!assigneeId) return null;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
    include: { user: { select: { name: true } } },
  });
  if (!member) {
    throw new AppError(400, 'The assignee must be a member of this project');
  }
  return member.user.name;
}

/** Tasks that are not done and are overdue or due within the next few days. */
export function needsAttentionWhere(): Prisma.TaskWhereInput {
  return { status: { not: 'DONE' }, dueDate: { lte: daysFromToday(DUE_SOON_DAYS) } };
}

export async function listTasks(userId: string, query: ListTasksQuery) {
  // Every condition is ANDed together, starting with "tasks I'm allowed to see".
  const conditions: Prisma.TaskWhereInput[] = [visibleTasksWhere(userId)];
  if (query.projectId) conditions.push({ projectId: query.projectId });
  if (query.status) conditions.push({ status: query.status });
  if (query.priority) conditions.push({ priority: query.priority });
  if (query.search) conditions.push({ title: { contains: query.search, mode: 'insensitive' } });
  if (query.assigneeId) {
    conditions.push({ assigneeId: query.assigneeId === 'unassigned' ? null : query.assigneeId });
  }
  if (query.due === 'overdue') {
    conditions.push({ status: { not: 'DONE' }, dueDate: { lt: daysFromToday(0) } });
  }
  if (query.due === 'soon') {
    conditions.push({ status: { not: 'DONE' }, dueDate: { gte: daysFromToday(0), lte: daysFromToday(DUE_SOON_DAYS) } });
  }
  if (query.due === 'attention') {
    conditions.push(needsAttentionWhere());
  }
  const where: Prisma.TaskWhereInput = { AND: conditions };

  const { page, limit } = query;
  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    data: tasks,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export function getTask(userId: string, taskId: string) {
  return findOpenableTask(userId, taskId);
}

/**
 * Owner/admins create tasks for anyone (unassigned unless an assignee is chosen).
 * Members create tasks for themselves only: the task is always assigned to them,
 * so allocating work to other people stays with the owner/admins.
 */
export async function createTask(userId: string, data: CreateTaskInput) {
  const membership = await requireMember(userId, data.projectId);

  if (!isManager(membership.role)) {
    if (data.assigneeId && data.assigneeId !== userId) {
      throw new AppError(403, 'Members can only create tasks for themselves. Ask a project admin to assign work to others.');
    }
    data = { ...data, assigneeId: userId };
  }
  await checkAssignee(data.projectId, data.assigneeId);

  return prisma.task.create({
    data: {
      ...data,
      createdById: userId,
      activities: { create: { actorId: userId, action: 'CREATED' } },
    },
    include: taskInclude,
  });
}

/**
 * Owner/admins can change anything.
 * Members can edit tasks they created themselves (but not hand them to someone else),
 * and only change the status of tasks an admin assigned to them.
 * A member who was only @mentioned on a task can read and comment, but not change it.
 * Every real change is recorded in the task's history.
 */
export async function updateTask(userId: string, taskId: string, data: UpdateTaskInput) {
  const task = await findOpenableTask(userId, taskId);
  const membership = await requireMember(userId, task.projectId);

  if (!isManager(membership.role)) {
    if (task.assigneeId !== userId) {
      throw new AppError(403, 'You were tagged on this task, so you can read and comment on it. Only its assignee or a project admin can change it.');
    }
    const reassigning = data.assigneeId !== undefined && data.assigneeId !== userId;
    const changesMoreThanStatus = Object.keys(data).some((field) => field !== 'status');

    if (reassigning) {
      throw new AppError(403, 'Only project admins can assign tasks to other people');
    }
    if (task.createdById !== userId && changesMoreThanStatus) {
      throw new AppError(403, 'Only project admins can edit tasks they assigned to you. You can change the status.');
    }
  }
  const newAssigneeName = data.assigneeId !== undefined ? await checkAssignee(task.projectId, data.assigneeId) : null;

  const changes = diffTask(task, data, newAssigneeName);
  if (changes.length === 0) {
    return task;
  }

  // Save the change and its history entry together: either both happen or neither does.
  const [updated] = await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data, include: taskInclude }),
    prisma.taskActivity.create({ data: { taskId, actorId: userId, action: 'UPDATED', changes } }),
  ]);
  return updated;
}

/** Owner/admins can delete any task; members only their own tasks (created by and assigned to them). */
export async function deleteTask(userId: string, taskId: string) {
  const task = await findOpenableTask(userId, taskId);
  const membership = await requireMember(userId, task.projectId);

  const ownTask = task.createdById === userId && task.assigneeId === userId;
  if (!isManager(membership.role) && !ownTask) {
    throw new AppError(403, 'Only project admins can delete this task');
  }
  await prisma.task.delete({ where: { id: taskId } });
}

/** The task's history, newest first. */
export async function getTaskActivity(userId: string, taskId: string) {
  await findOpenableTask(userId, taskId);
  return prisma.taskActivity.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { id: true, name: true } } },
  });
}
