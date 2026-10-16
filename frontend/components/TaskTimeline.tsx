import { formatDate, formatDateTime, PRIORITY_LABELS, STATUS_LABELS } from '@/lib/format';
import type { Activity, FieldChange, TaskPriority, TaskStatus } from '@/lib/types';
import { Avatar } from './ui/Avatar';

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  dueDate: 'due date',
  assignee: 'assignee',
};

/** Turns a stored value into something readable ("IN_PROGRESS" -> "In Progress"). */
function formatValue(field: string, value: string | null): string {
  if (value === null || value === '') return field === 'assignee' ? 'Unassigned' : 'empty';
  if (field === 'status') return STATUS_LABELS[value as TaskStatus] ?? value;
  if (field === 'priority') return PRIORITY_LABELS[value as TaskPriority] ?? value;
  if (field === 'dueDate') return formatDate(value);
  return value;
}

function ChangeLine({ change }: { change: FieldChange }) {
  const label = FIELD_LABELS[change.field] ?? change.field;

  // Long text: just say it changed.
  if (change.field === 'description') {
    return <li>updated the description</li>;
  }
  return (
    <li>
      changed {label} from <span className="font-medium text-slate-700">{formatValue(change.field, change.from)}</span> to{' '}
      <span className="font-medium text-slate-700">{formatValue(change.field, change.to)}</span>
    </li>
  );
}

/** Vertical timeline of everything that happened to a task, newest first. */
export function TaskTimeline({ entries }: { entries: Activity[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">No history yet.</p>;
  }

  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-6">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute top-0 -left-[37px] rounded-full bg-white p-0.5">
            <Avatar user={entry.actor} />
          </span>
          <p className="text-sm text-slate-800">
            <span className="font-medium">{entry.actor.name}</span>{' '}
            {entry.action === 'CREATED' ? 'created this task' : 'updated this task'}
          </p>
          {entry.changes.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-sm text-slate-500">
              {entry.changes.map((change) => (
                <ChangeLine key={change.field} change={change} />
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
