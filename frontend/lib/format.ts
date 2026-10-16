import type { ProjectRole, TaskPriority, TaskStatus } from './types';

export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
export const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
};

/** Owners and admins manage a project: its tasks, members and invitations (same rule as the API). */
export function canManage(role: ProjectRole | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/** How many days ahead counts as "due soon" (same as the API). */
export const DUE_SOON_DAYS = 3;

/** Today's date as "YYYY-MM-DD" in UTC, the same rule the API uses for "overdue". */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "2026-01-15T00:00:00.000Z" -> "2026-01-15" (for <input type="date">). */
export function toDateInput(isoDate: string): string {
  return isoDate.slice(0, 10);
}

/** Due dates are calendar days, so format them in UTC to avoid showing the previous day. */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Whole days from today until the due date (negative = overdue). */
export function daysUntilDue(isoDate: string): number {
  const ms = new Date(toDateInput(isoDate)).getTime() - new Date(todayUtc()).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export type DueState = 'done' | 'overdue' | 'soon' | 'later';

export function dueState(task: { status: TaskStatus; dueDate: string }): DueState {
  if (task.status === 'DONE') return 'done';
  const days = daysUntilDue(task.dueDate);
  if (days < 0) return 'overdue';
  if (days <= DUE_SOON_DAYS) return 'soon';
  return 'later';
}

/** "Overdue by 2 days", "Due today", "Due tomorrow", "Due in 3 days" or "Due Jan 15, 2026". */
export function dueLabel(task: { status: TaskStatus; dueDate: string }): string {
  const days = daysUntilDue(task.dueDate);
  const state = dueState(task);
  if (state === 'overdue') return `Overdue by ${-days} day${days === -1 ? '' : 's'}`;
  if (state === 'soon') {
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  }
  return `Due ${formatDate(task.dueDate)}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
