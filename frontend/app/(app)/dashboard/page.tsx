'use client';

import { AtSign, CircleCheckBig, FolderPlus } from 'lucide-react';
import Link from 'next/link';
import { projectColor } from '@/components/ProjectCard';
import { Avatar } from '@/components/ui/Avatar';
import { DueDate, PriorityBadge, ProgressBar, StatCard } from '@/components/ui/Display';
import { EmptyState, ErrorMessage, Spinner } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { canManage, DUE_SOON_DAYS, dueState, formatDateTime, greeting, STATUSES, STATUS_LABELS } from '@/lib/format';
import type { DashboardStats, Mention, Project, Task, TaskStatus } from '@/lib/types';

// The dashboard shows short lists; "View all" opens the full list.
const DASHBOARD_LIST_SIZE = 4;

// Hex colors for the donut chart (CSS conic-gradient needs real colors, not Tailwind classes).
const STATUS_COLORS: Record<TaskStatus, string> = {
  DONE: '#16a34a',
  IN_PROGRESS: '#2563eb',
  TODO: '#f59e0b',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const stats = useApi<DashboardStats>('/dashboard');
  const projects = useApi<{ data: Project[] }>('/projects');

  const firstName = user?.name.split(' ')[0];
  const adminsSomething = projects.data?.data.some((p) => canManage(p.myRole));

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${firstName}!`}
        subtitle={
          adminsSomething
            ? "Here's your work, plus your team's tasks in the projects you own or admin."
            : "Here's what's happening with your tasks today."
        }
      />

      {stats.error ? (
        <ErrorMessage message={stats.error} onRetry={stats.reload} />
      ) : !stats.data ? (
        <Spinner />
      ) : (
        <>
          {/* Each card opens the matching list. */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total projects" value={stats.data.totalProjects} valueClass="text-blue-600" href="/projects" />
            <StatCard label="Total tasks" value={stats.data.totalTasks} valueClass="text-violet-600" href="/tasks" />
            <StatCard label="Completed" value={stats.data.completedTasks} valueClass="text-green-600" href="/tasks?status=DONE" />
            <StatCard
              label="Overdue"
              value={stats.data.overdueTasks}
              valueClass="text-red-600"
              hint="Not done and past due"
              href="/tasks?due=overdue"
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <NeedsAttention attention={stats.data.attention} />
            <TasksByStatus stats={stats.data} />
          </div>

          {/* Only shown when someone has tagged you in a comment. */}
          {stats.data.mentions.length > 0 && (
            <div className="mt-6">
              <MentionedYou mentions={stats.data.mentions} />
            </div>
          )}

          <div className="mt-6">
            <ProjectProgress projects={projects.data?.data} error={projects.error} />
          </div>
        </>
      )}
    </div>
  );
}

const attentionBar = { overdue: 'bg-red-500', soon: 'bg-amber-400', later: 'bg-slate-200', done: 'bg-slate-200' };

/** The latest comments that @mention you, each linking to its task. */
function MentionedYou({ mentions }: { mentions: Mention[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <AtSign size={18} className="text-blue-600" /> Mentioned you
      </h2>
      <p className="mb-4 text-sm text-slate-500">Recent comments where someone tagged you</p>
      <ul className="divide-y divide-slate-100">
        {mentions.map((mention) => (
          <li key={mention.id}>
            <Link href={`/tasks/${mention.task.id}`} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
              <Avatar user={mention.author} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{mention.author.name}</span> on{' '}
                  <span className="font-medium">{mention.task.title}</span>
                  <span className="text-slate-400"> · {mention.task.project.name}</span>
                </p>
                <p className="truncate text-sm text-slate-500">{mention.body}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{formatDateTime(mention.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NeedsAttention({ attention }: { attention: DashboardStats['attention'] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-3">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            Needs attention
            {attention.total > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">{attention.total}</span>
            )}
          </h2>
          <p className="text-sm text-slate-500">Overdue, or due in the next {DUE_SOON_DAYS} days</p>
        </div>
      </div>

      {attention.tasks.length === 0 ? (
        <EmptyState
          icon={<CircleCheckBig size={36} className="text-green-500" />}
          title="All caught up"
          description={`Nothing is overdue or due in the next ${DUE_SOON_DAYS} days.`}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {attention.tasks.slice(0, DASHBOARD_LIST_SIZE).map((task: Task) => (
            <li key={task.id}>
              <Link href={`/tasks/${task.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
                <span className={`h-9 w-1 shrink-0 rounded-full ${attentionBar[dueState(task)]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {task.project.name} · {STATUS_LABELS[task.status]}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <PriorityBadge priority={task.priority} />
                </div>
                <div className="w-28 text-right">
                  <DueDate task={task} />
                </div>
                <Avatar user={task.assignee} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {attention.total > attention.tasks.length && (
        <ViewAll href="/tasks?due=attention" label={`View all ${attention.total} tasks`} />
      )}
    </div>
  );
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mt-3 block rounded-lg border border-slate-200 py-2 text-center text-sm font-medium text-blue-600 hover:bg-slate-50">
      {label} →
    </Link>
  );
}

function TasksByStatus({ stats }: { stats: DashboardStats }) {
  const { tasksByStatus, totalTasks, completionRate } = stats;

  // Build the donut slices: each status takes its share of the 360° circle.
  let start = 0;
  const slices = STATUSES.map((status) => {
    const share = totalTasks ? (tasksByStatus[status] / totalTasks) * 100 : 0;
    const slice = `${STATUS_COLORS[status]} ${start}% ${start + share}%`;
    start += share;
    return slice;
  });
  const background = totalTasks ? `conic-gradient(${slices.join(', ')})` : '#e2e8f0';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Tasks by status</h2>
        <Link href="/tasks" className="text-sm font-medium text-blue-600 hover:underline">
          View board
        </Link>
      </div>
      <Link href="/tasks" className="my-6 flex justify-center" aria-label="Open the task board">
        <div className="relative h-40 w-40 rounded-full transition hover:scale-[1.03]" style={{ background }}>
          <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-2xl font-bold text-slate-900">{completionRate}%</span>
            <span className="text-xs text-slate-500">complete</span>
          </div>
        </div>
      </Link>
      {/* Each row opens the tasks with that status. */}
      <ul className="space-y-1 text-sm">
        {(['DONE', 'IN_PROGRESS', 'TODO'] as const).map((status) => (
          <li key={status}>
            <Link href={`/tasks?status=${status}`} className="-mx-2 flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                {STATUS_LABELS[status]}
              </span>
              <span className="font-semibold text-slate-900">{tasksByStatus[status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectProgress({ projects, error }: { projects?: Project[]; error?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Project progress</h2>
          <p className="text-sm text-slate-500">Completion of the tasks you can see in each project</p>
        </div>
      </div>

      {error ? (
        <ErrorMessage message={error} />
      ) : !projects ? (
        <Spinner />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderPlus size={36} />}
          title="No projects yet"
          action={<Link href="/projects" className="text-sm font-medium text-blue-600 hover:underline">Create your first project →</Link>}
        />
      ) : (
        <ul className="grid gap-x-8 gap-y-2 md:grid-cols-2">
          {projects.slice(0, DASHBOARD_LIST_SIZE).map((project, index) => (
            <li key={project.id}>
              <Link href={`/projects/${project.id}`} className="-mx-2 block rounded-lg px-2 py-2 hover:bg-slate-50">
                <div className="mb-2 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{project.name}</p>
                    <p className="text-xs text-slate-500">
                      {project.doneTasks} of {project.totalTasks} tasks
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{project.progress}%</span>
                </div>
                <ProgressBar value={project.progress} color={projectColor(index)} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {projects && projects.length > DASHBOARD_LIST_SIZE && (
        <ViewAll href="/projects" label={`View all ${projects.length} projects`} />
      )}
    </div>
  );
}
