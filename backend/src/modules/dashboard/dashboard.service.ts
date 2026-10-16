import { prisma } from '../../db';
import { todayUtc } from '../../utils/dates';
import { progressPercent } from '../../utils/progress';
import { visibleTasksWhere } from '../projects/projectAccess';
import { needsAttentionWhere, taskInclude } from '../tasks/tasks.service';

type TaskStatsRow = {
  totalTasks: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
};

// The dashboard shows a short list; "View all" opens the full filtered list.
const ATTENTION_LIST_SIZE = 4;

/**
 * Dashboard numbers for the tasks this user can see:
 * every task in projects they own/admin, plus tasks assigned to them elsewhere.
 *
 * All counts come from ONE aggregate query in Postgres, instead of loading every task into Node.
 * Overdue = due date is before today AND the task is not done.
 */
export async function getDashboardStats(userId: string) {
  const today = todayUtc();
  const attentionWhere = { AND: [visibleTasksWhere(userId), needsAttentionWhere()] };

  const [totalProjects, [stats], attentionTasks, attentionCount, mentions] = await Promise.all([
    prisma.projectMember.count({ where: { userId } }),
    prisma.$queryRaw<TaskStatsRow[]>`
      SELECT
        COUNT(*)::int                                                     AS "totalTasks",
        COUNT(*) FILTER (WHERE t.status = 'TODO')::int                    AS "todo",
        COUNT(*) FILTER (WHERE t.status = 'IN_PROGRESS')::int             AS "inProgress",
        COUNT(*) FILTER (WHERE t.status = 'DONE')::int                    AS "done",
        COUNT(*) FILTER (WHERE t.status <> 'DONE' AND t.due_date < ${today}::date)::int AS "overdue"
      FROM tasks t
      JOIN project_members m ON m.project_id = t.project_id AND m.user_id = ${userId}
      WHERE m.role IN ('OWNER', 'ADMIN') OR t.assignee_id = ${userId}
    `,
    // "Needs attention": overdue first, then soonest due, high priority first.
    prisma.task.findMany({
      where: attentionWhere,
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: ATTENTION_LIST_SIZE,
    }),
    prisma.task.count({ where: attentionWhere }),
    // "Mentioned you": the latest comments that tag this user, in projects they're still in.
    prisma.taskComment.findMany({
      where: { mentionedUserIds: { has: userId }, task: { project: { members: { some: { userId } } } } },
      orderBy: { createdAt: 'desc' },
      take: ATTENTION_LIST_SIZE,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, project: { select: { name: true } } } },
      },
    }),
  ]);

  return {
    totalProjects,
    totalTasks: stats.totalTasks,
    completedTasks: stats.done,
    overdueTasks: stats.overdue,
    completionRate: progressPercent(stats.done, stats.totalTasks),
    tasksByStatus: {
      TODO: stats.todo,
      IN_PROGRESS: stats.inProgress,
      DONE: stats.done,
    },
    attention: { total: attentionCount, tasks: attentionTasks },
    mentions,
  };
}
