'use client';

import { ListTodo, Plus, Search, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { canManage, DUE_SOON_DAYS, PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '@/lib/format';
import { errorMessage } from '@/lib/formErrors';
import type { Member, Paginated, Project, Task, TaskPriority, TaskStatus } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { TaskForm } from './TaskForm';
import { Button } from './ui/Button';
import { EmptyState, ErrorMessage, Spinner } from './ui/Feedback';
import { Select } from './ui/FormFields';
import { Modal } from './ui/Modal';

const PAGE_SIZE = 50;

// Same colors as the dashboard's "Tasks by status" chart.
const columnDot: Record<TaskStatus, string> = {
  TODO: 'bg-amber-500',
  IN_PROGRESS: 'bg-blue-600',
  DONE: 'bg-green-600',
};

export type DueFilter = '' | 'attention' | 'overdue' | 'soon';

export type TaskFilters = {
  search: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  due: DueFilter;
  /** A user id, "unassigned", or '' for anyone. */
  assigneeId: string;
  projectId: string;
};

const NO_FILTERS: TaskFilters = { search: '', status: '', priority: '', due: '', assigneeId: '', projectId: '' };

type TasksViewProps = {
  /** When set, only this project's tasks are shown (used on the project page). */
  projectId?: string;
  /** Filters to start with (e.g. from a dashboard link like /tasks?status=DONE). */
  initialFilters?: Partial<TaskFilters>;
  /** Called after any task is created or changed. */
  onTasksChanged?: () => void;
};

/** Filters + search + a 3-column board of tasks. Used on /tasks and on each project's page. */
export function TasksView({ projectId, initialFilters, onTasksChanged }: TasksViewProps) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<TaskFilters>({ ...NO_FILTERS, ...initialFilters });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState('');

  const projects = useApi<{ data: Project[] }>('/projects');
  const projectList = projects.data?.data ?? [];
  // Projects where you're owner/admin: you see everyone's tasks there and can assign work.
  const adminProjectIds = projectList.filter((p) => canManage(p.myRole)).map((p) => p.id);

  // Only owners/admins see everyone's tasks, so only they get the assignee filter.
  // (Anyone can create tasks; members' tasks are assigned to themselves.)
  const isManager = projectId ? adminProjectIds.includes(projectId) : adminProjectIds.length > 0;
  // Which project's members to offer in that filter (the current project, or the one picked in the filter).
  const activeProject = projectId ?? filters.projectId;
  const membersProject = activeProject && adminProjectIds.includes(activeProject) ? activeProject : null;
  const members = useApi<{ data: Member[] }>(membersProject ? `/projects/${membersProject}/members` : null);

  // Wait until the user stops typing before searching.
  const debouncedSearch = useDebounce(filters.search.trim());

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (activeProject) params.set('projectId', activeProject);
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.due) params.set('due', filters.due);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (debouncedSearch) params.set('search', debouncedSearch);

  const tasks = useApi<Paginated<Task>>(`/tasks?${params}`);

  const hasFilters = Object.entries(filters).some(([key, value]) => value && !(key === 'projectId' && projectId));

  // Any filter change goes back to page 1.
  function setFilter<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      // A different project has different members, so reset the assignee filter.
      ...(key === 'projectId' && { assigneeId: '' }),
    }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(NO_FILTERS);
    setPage(1);
  }

  function refresh() {
    tasks.reload();
    projects.reload();
    onTasksChanged?.();
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    setActionError('');
    try {
      await api(`/tasks/${task.id}`, { method: 'PATCH', body: { status } });
      refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const visibleStatuses = filters.status ? [filters.status] : STATUSES;
  const result = tasks.data;

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="Search tasks by title..."
              className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              aria-label="Search tasks"
            />
          </div>
          <Button onClick={() => setCreating(true)} disabled={projectList.length === 0} className="whitespace-nowrap">
            <Plus size={16} /> New task
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:flex">
          {!projectId && (
            <Select value={filters.projectId} onChange={(e) => setFilter('projectId', e.target.value)} aria-label="Filter by project">
              <option value="">All projects</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value as TaskStatus | '')} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select value={filters.priority} onChange={(e) => setFilter('priority', e.target.value as TaskPriority | '')} aria-label="Filter by priority">
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
          <Select value={filters.due} onChange={(e) => setFilter('due', e.target.value as DueFilter)} aria-label="Filter by due date">
            <option value="">Any due date</option>
            <option value="attention">Needs attention</option>
            <option value="overdue">Overdue</option>
            <option value="soon">Due in next {DUE_SOON_DAYS} days</option>
          </Select>
          {isManager && (
            <Select value={filters.assigneeId} onChange={(e) => setFilter('assigneeId', e.target.value)} aria-label="Filter by assignee">
              <option value="">Anyone</option>
              {user && <option value={user.id}>Assigned to me</option>}
              <option value="unassigned">Unassigned</option>
              {members.data?.data
                .filter((member) => member.userId !== user?.id)
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
            </Select>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4">
          <ErrorMessage message={actionError} />
        </div>
      )}

      {/* Board */}
      {tasks.error ? (
        <ErrorMessage message={tasks.error} onRetry={tasks.reload} />
      ) : !result ? (
        <Spinner label="Loading tasks..." />
      ) : result.data.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<SearchX size={40} />}
            title="No tasks match your filters"
            description="Try a different search term, or clear the filters to see all tasks."
            action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : projects.data && projectList.length === 0 ? (
          <EmptyState
            icon={<ListTodo size={40} />}
            title="Create a project first"
            description="Tasks live inside projects. Create a project, then add tasks to it."
            action={<Link href="/projects" className="text-sm font-medium text-blue-600 hover:underline">Go to projects →</Link>}
          />
        ) : isManager ? (
          <EmptyState
            icon={<ListTodo size={40} />}
            title="No tasks yet"
            description="Create a task and assign it to someone on the team."
            action={<Button onClick={() => setCreating(true)}><Plus size={16} /> New task</Button>}
          />
        ) : (
          <EmptyState
            icon={<ListTodo size={40} />}
            title="Nothing assigned to you yet"
            description="Tasks appear here when a project admin assigns them to you. You can also add your own."
            action={<Button onClick={() => setCreating(true)}><Plus size={16} /> New task</Button>}
          />
        )
      ) : (
        <div className={`transition-opacity ${tasks.loading ? 'opacity-60' : ''}`}>
          <div className={`grid gap-4 ${visibleStatuses.length > 1 ? 'md:grid-cols-3' : ''}`}>
            {visibleStatuses.map((columnStatus) => {
              const columnTasks = result.data.filter((task) => task.status === columnStatus);
              return (
                <section key={columnStatus} className="rounded-xl bg-slate-100 p-3">
                  <h3 className="mb-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${columnDot[columnStatus]}`} />
                      {STATUS_LABELS[columnStatus]}
                    </span>
                    <span className="text-slate-400">{columnTasks.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {columnTasks.length === 0 && <p className="py-6 text-center text-xs text-slate-400">No tasks</p>}
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showProject={!projectId}
                        onStatusChange={(status) => changeStatus(task, status)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {result.meta.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
              <span>
                Page {result.meta.page} of {result.meta.totalPages} · {result.meta.total} tasks
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                  Previous
                </Button>
                <Button variant="secondary" onClick={() => setPage(page + 1)} disabled={page >= result.meta.totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {creating && (
        <Modal title="New task" onClose={() => setCreating(false)}>
          <TaskForm
            fixedProjectId={projectId}
            projects={projectList}
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
