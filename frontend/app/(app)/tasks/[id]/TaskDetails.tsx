'use client';

import { ArrowLeft, AtSign, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Comments } from '@/components/Comments';
import { TaskForm } from '@/components/TaskForm';
import { TaskTimeline } from '@/components/TaskTimeline';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DueDate, PriorityBadge } from '@/components/ui/Display';
import { ErrorMessage, Spinner } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/FormFields';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { canManage, dueState, formatDate, formatDateTime, STATUSES, STATUS_LABELS } from '@/lib/format';
import { errorMessage } from '@/lib/formErrors';
import type { Activity, Project, Task, TaskStatus } from '@/lib/types';

/** One task: its details on the left, its change history on the right. */
export function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const task = useApi<Task>(`/tasks/${id}`);
  const activity = useApi<{ data: Activity[] }>(`/tasks/${id}/activity`);
  // Needed to know whether you're an admin of the task's project.
  const project = useApi<Project>(task.data ? `/projects/${task.data.projectId}` : null);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState('');

  function refresh() {
    task.reload();
    activity.reload();
  }

  async function changeStatus(status: TaskStatus) {
    setActionError('');
    try {
      await api(`/tasks/${id}`, { method: 'PATCH', body: { status } });
      refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!task.data || !window.confirm(`Delete "${task.data.title}"? This can't be undone.`)) return;
    try {
      await api(`/tasks/${id}`, { method: 'DELETE' });
      router.push(`/projects/${task.data.projectId}`);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  if (task.error) {
    return (
      <div>
        <Link href="/tasks" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> All tasks
        </Link>
        <ErrorMessage message={task.error} />
      </div>
    );
  }

  if (!task.data) {
    return <Spinner />;
  }

  const t = task.data;
  // Same rules as the API:
  //  - owner/admins: change anything
  //  - the assignee: change the status; also edit/delete it if they created it themselves
  //  - a member who was only @mentioned: read and comment
  const isManager = canManage(project.data?.myRole);
  const isAssignee = t.assigneeId === user?.id;
  const canChangeStatus = isManager || isAssignee;
  const canEdit = isManager || (isAssignee && t.createdById === user?.id);
  const onlyTagged = project.data !== undefined && !canChangeStatus;

  return (
    <div>
      <Link href={`/projects/${t.projectId}`} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> {t.project.name}
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Details */}
        <div className="space-y-4 lg:col-span-2">
          {actionError && <ErrorMessage message={actionError} />}
          {onlyTagged && (
            <p className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800" role="status">
              <AtSign size={16} className="shrink-0" />
              You were tagged on this task, so you can read it and reply in the comments. Only its assignee or a project admin can change it.
            </p>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <h1 className={`text-2xl font-bold ${t.status === 'DONE' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{t.title}</h1>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button variant="secondary" onClick={handleDelete} className="text-red-600">
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              )}
            </div>

            <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Status">
                <Select
                  value={t.status}
                  onChange={(e) => changeStatus(e.target.value as TaskStatus)}
                  disabled={!canChangeStatus}
                  aria-label="Status"
                  className="py-1"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority">
                <PriorityBadge priority={t.priority} />
              </Field>
              <Field label="Assignee">
                <span className="flex items-center gap-2">
                  <Avatar user={t.assignee} />
                  {t.assignee?.name ?? <span className="text-slate-400">Unassigned</span>}
                </span>
              </Field>
              <Field label="Due date">
                <span className="flex flex-wrap items-center gap-2">
                  {formatDate(t.dueDate)}
                  {/* Add "Overdue by 2 days" / "Due tomorrow" when it matters. */}
                  {(dueState(t) === 'overdue' || dueState(t) === 'soon') && <DueDate task={t} />}
                </span>
              </Field>
              <Field label="Project">
                <Link href={`/projects/${t.projectId}`} className="text-blue-600 hover:underline">
                  {t.project.name}
                </Link>
              </Field>
              <Field label="Created">
                {t.createdBy.name} · {formatDateTime(t.createdAt)}
              </Field>
            </dl>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <h2 className="mb-2 text-sm font-medium text-slate-500">Description</h2>
              {t.description ? (
                <p className="text-sm whitespace-pre-wrap text-slate-700">{t.description}</p>
              ) : (
                <p className="text-sm text-slate-400">No description.</p>
              )}
            </div>
          </div>

          <Comments taskId={id} canModerate={isManager} />
        </div>

        {/* History */}
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-slate-900">History</h2>
          {activity.error ? (
            <ErrorMessage message={activity.error} onRetry={activity.reload} />
          ) : !activity.data ? (
            <Spinner />
          ) : (
            <TaskTimeline entries={activity.data.data} />
          )}
        </aside>
      </div>

      {editing && (
        <Modal title="Edit task" onClose={() => setEditing(false)}>
          <TaskForm
            task={t}
            projects={project.data ? [project.data] : []}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}
