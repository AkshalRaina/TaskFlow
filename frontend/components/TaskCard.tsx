'use client';

import { useRouter } from 'next/navigation';
import { dueState, STATUSES, STATUS_LABELS } from '@/lib/format';
import type { Task, TaskStatus } from '@/lib/types';
import { Avatar } from './ui/Avatar';
import { DueDate, PriorityBadge } from './ui/Display';

type TaskCardProps = {
  task: Task;
  showProject: boolean;
  onStatusChange: (status: TaskStatus) => void;
};

const borderByDue = {
  overdue: 'border-l-red-500',
  soon: 'border-l-amber-400',
  later: 'border-l-transparent',
  done: 'border-l-transparent',
};

/** Clicking the card opens the task. The status dropdown changes status without opening it. */
export function TaskCard({ task, showProject, onStatusChange }: TaskCardProps) {
  const router = useRouter();
  const open = () => router.push(`/tasks/${task.id}`);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => event.key === 'Enter' && open()}
      className={`cursor-pointer rounded-lg border border-l-4 border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md ${borderByDue[dueState(task)]}`}
    >
      <h4 className={`font-medium ${task.status === 'DONE' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{task.title}</h4>
      {showProject && <p className="mt-0.5 truncate text-xs text-slate-500">{task.project.name}</p>}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <DueDate task={task} />
        </div>
        <Avatar user={task.assignee} />
      </div>

      <select
        value={task.status}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
        className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
        aria-label={`Status of ${task.title}`}
      >
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}
