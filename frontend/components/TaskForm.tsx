'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { canManage, PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, toDateInput } from '@/lib/format';
import { errorMessage, toFieldErrors } from '@/lib/formErrors';
import type { Member, Project, Task, TaskPriority, TaskStatus } from '@/lib/types';
import { Button } from './ui/Button';
import { ErrorMessage } from './ui/Feedback';
import { Input, Select, Textarea } from './ui/FormFields';

type TaskFormProps = {
  /** Pass a task to edit it; leave empty to create a new one. */
  task?: Task;
  /**
   * Set when the form is opened inside a project: the task goes into that project
   * and the project picker is hidden. Otherwise the user picks from `projects`.
   */
  fixedProjectId?: string;
  /** Projects to choose from, with your role in each (decides whether you can pick an assignee). */
  projects?: Project[];
  onSaved: (task: Task) => void;
  onCancel: () => void;
};

export function TaskForm({ task, fixedProjectId, projects = [], onSaved, onCancel }: TaskFormProps) {
  const { user } = useAuth();
  // Editing keeps the task in its project; inside a project page it's fixed; otherwise the user chooses.
  const lockedProjectId = task?.projectId ?? fixedProjectId;

  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    projectId: lockedProjectId ?? projects[0]?.id ?? '',
    status: task?.status ?? ('TODO' as TaskStatus),
    priority: task?.priority ?? ('MEDIUM' as TaskPriority),
    dueDate: task ? toDateInput(task.dueDate) : '',
    // '' means unassigned (new tasks are unassigned by default)
    assigneeId: task?.assigneeId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Owner/admins assign tasks to anyone in the project; a member's tasks are always their own.
  const canAssign = canManage(projects.find((p) => p.id === form.projectId)?.myRole);
  // People you can assign to = members of the selected project.
  const members = useApi<{ data: Member[] }>(canAssign && form.projectId ? `/projects/${form.projectId}/members` : null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.projectId) errors.projectId = 'Choose a project';
    if (!form.dueDate) errors.dueDate = 'Due date is required';
    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const { projectId, assigneeId, ...fields } = form;
    const body = { ...fields, assigneeId: canAssign ? assigneeId || null : (user?.id ?? null) };

    setSaving(true);
    setError('');
    try {
      const saved = task
        ? await api<Task>(`/tasks/${task.id}`, { method: 'PATCH', body })
        : await api<Task>('/tasks', { method: 'POST', body: { ...body, projectId } });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setFieldErrors(toFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <ErrorMessage message={error} />}
      <Input
        label="Title"
        value={form.title}
        onChange={(e) => update('title', e.target.value)}
        error={fieldErrors.title}
        maxLength={200}
        autoFocus
      />
      <Textarea
        label="Description"
        value={form.description}
        onChange={(e) => update('description', e.target.value)}
        error={fieldErrors.description}
        maxLength={2000}
      />

      {!lockedProjectId && (
        <Select
          label="Project"
          value={form.projectId}
          // A different project has different members, so reset the assignee.
          onChange={(e) => setForm((current) => ({ ...current, projectId: e.target.value, assigneeId: '' }))}
          error={fieldErrors.projectId}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      )}

      {canAssign ? (
        <Select label="Assignee" value={form.assigneeId} onChange={(e) => update('assigneeId', e.target.value)} error={fieldErrors.assigneeId}>
          <option value="">Unassigned</option>
          {members.data?.data.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </Select>
      ) : (
        <div>
          <Input label="Assignee" value={`${user?.name ?? ''} (you)`} readOnly disabled />
          <p className="mt-1 text-xs text-slate-500">Tasks you create are assigned to you. Project admins assign work to others.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Status" value={form.status} onChange={(e) => update('status', e.target.value as TaskStatus)}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Select label="Priority" value={form.priority} onChange={(e) => update('priority', e.target.value as TaskPriority)}>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </Select>
        <Input
          label="Due date"
          type="date"
          value={form.dueDate}
          onChange={(e) => update('dueDate', e.target.value)}
          error={fieldErrors.dueDate}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {task ? 'Save changes' : 'Create task'}
        </Button>
      </div>
    </form>
  );
}
