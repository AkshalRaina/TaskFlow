'use client';

import { useSearchParams } from 'next/navigation';
import { TasksView, type DueFilter, type TaskFilters } from '@/components/TasksView';
import type { TaskPriority, TaskStatus } from '@/lib/types';

/** Reads starting filters from the URL, e.g. /tasks?status=DONE or /tasks?due=overdue (used by dashboard links). */
export function TasksPageContent() {
  const searchParams = useSearchParams();

  const initialFilters: Partial<TaskFilters> = {
    status: (searchParams.get('status') ?? '') as TaskStatus | '',
    priority: (searchParams.get('priority') ?? '') as TaskPriority | '',
    due: (searchParams.get('due') ?? '') as DueFilter,
    assigneeId: searchParams.get('assigneeId') ?? '',
    projectId: searchParams.get('projectId') ?? '',
  };

  // `key` starts the view fresh when the URL changes (e.g. clicking "Tasks" in the sidebar clears the filters).
  return <TasksView key={searchParams.toString()} initialFilters={initialFilters} />;
}
