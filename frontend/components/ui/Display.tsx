import Link from 'next/link';
import { dueLabel, dueState, PRIORITY_LABELS, ROLE_LABELS, type DueState } from '@/lib/format';
import type { ProjectRole, TaskPriority, TaskStatus } from '@/lib/types';

/** Small display components: progress bar, badges and stat cards. */

export function ProgressBar({ value, color = 'bg-blue-600' }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

const priorityStyles: Record<TaskPriority, string> = {
  HIGH: 'bg-red-50 text-red-700 ring-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  LOW: 'bg-green-50 text-green-700 ring-green-200',
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${priorityStyles[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const roleStyles: Record<ProjectRole, string> = {
  OWNER: 'bg-violet-50 text-violet-700 ring-violet-200',
  ADMIN: 'bg-blue-50 text-blue-700 ring-blue-200',
  MEMBER: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function RoleBadge({ role }: { role: ProjectRole }) {
  const style = roleStyles[role];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>{ROLE_LABELS[role]}</span>;
}

const dueStyles: Record<DueState, string> = {
  overdue: 'font-medium text-red-600',
  soon: 'font-medium text-amber-600',
  later: 'text-slate-500',
  done: 'text-slate-400',
};

/** "Overdue by 2 days" in red, "Due tomorrow" in amber, otherwise the date. */
export function DueDate({ task }: { task: { status: TaskStatus; dueDate: string } }) {
  return <span className={`text-xs ${dueStyles[dueState(task)]}`}>{dueLabel(task)}</span>;
}

type StatCardProps = {
  label: string;
  value: number;
  hint?: string;
  valueClass?: string;
  /** Makes the whole card a link (e.g. to the matching filtered task list). */
  href?: string;
};

export function StatCard({ label, value, hint, valueClass = 'text-slate-900', href }: StatCardProps) {
  const content = (
    <>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </>
  );
  const className = 'block rounded-xl border border-slate-200 bg-white p-5';

  return href ? (
    <Link href={href} className={`${className} transition hover:border-blue-300 hover:shadow-md`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
