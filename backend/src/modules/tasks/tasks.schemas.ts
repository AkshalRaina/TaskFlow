import { TaskPriority, TaskStatus } from '@prisma/client';
import { z } from 'zod';

// Enum values come straight from the Prisma schema, so there's one source of truth.
const status = z.enum(TaskStatus);
const priority = z.enum(TaskPriority);

const title = z.string().trim().min(1, 'Title is required').max(200);
const description = z.string().trim().max(2000);
// Due dates are calendar days ("2026-01-15"), stored in a DATE column.
const dueDate = z.iso.date('Due date must be in YYYY-MM-DD format').transform((value) => new Date(value));
// A user id, or null for "unassigned".
const assigneeId = z.string().min(1).nullable();

export const createTaskSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title,
  description: description.default(''),
  status: status.default('TODO'),
  priority: priority.default('MEDIUM'),
  dueDate,
  assigneeId: assigneeId.default(null),
});

// A task stays in the project it was created in, so projectId can't be changed.
export const updateTaskSchema = z.object({
  title: title.optional(),
  description: description.optional(),
  status: status.optional(),
  priority: priority.optional(),
  dueDate: dueDate.optional(),
  assigneeId: assigneeId.optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment first').max(2000),
  // Ids of the people tagged with "@Name" in the comment.
  mentionedUserIds: z.array(z.string().min(1)).max(20).default([]),
});

export const MAX_PAGE_SIZE = 100;

export const listTasksQuerySchema = z.object({
  projectId: z.string().optional(),
  status: status.optional(),
  priority: priority.optional(),
  search: z.string().trim().max(100).optional(),
  // A user id, or "unassigned".
  assigneeId: z.string().optional(),
  // Not-done tasks only. "overdue" = past due; "soon" = due in the next few days; "attention" = either.
  due: z.enum(['overdue', 'soon', 'attention']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  // Capped, so a single request can never pull the whole table.
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
