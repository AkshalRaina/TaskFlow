import { toDateString } from '../../utils/dates';
import type { UpdateTaskInput } from './tasks.schemas';

/** One changed field, stored in the task's history. Values are stored as readable strings. */
export type FieldChange = { field: string; from: string | null; to: string | null };

type TaskSnapshot = {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: Date;
  assignee: { id: string; name: string } | null;
};

/**
 * Compares the task before an update with the requested changes and lists what actually changed.
 * Fields that were sent but are unchanged are ignored, so the history only shows real changes.
 */
export function diffTask(before: TaskSnapshot, update: UpdateTaskInput, newAssigneeName: string | null): FieldChange[] {
  const changes: FieldChange[] = [];

  const compare = (field: string, from: string | null, to: string | null | undefined) => {
    if (to !== undefined && to !== from) changes.push({ field, from, to });
  };

  compare('title', before.title, update.title);
  compare('description', before.description, update.description);
  compare('status', before.status, update.status);
  compare('priority', before.priority, update.priority);
  compare('dueDate', toDateString(before.dueDate), update.dueDate && toDateString(update.dueDate));

  // Compare assignees by id, but store names so the timeline reads "Sam → Priya".
  if (update.assigneeId !== undefined && update.assigneeId !== (before.assignee?.id ?? null)) {
    changes.push({ field: 'assignee', from: before.assignee?.name ?? null, to: newAssigneeName });
  }

  return changes;
}
