import { Router } from 'express';
import { addComment, deleteComment, listComments } from './comments.service';
import { commentSchema, createTaskSchema, listTasksQuerySchema, updateTaskSchema } from './tasks.schemas';
import { createTask, deleteTask, getTask, getTaskActivity, listTasks, updateTask } from './tasks.service';

// Mounted behind `requireAuth`, so `req.userId` is always set here.
export const taskRoutes = Router();

// GET /api/tasks?projectId=&status=&priority=&search=&assigneeId=&due=&page=&limit=
taskRoutes.get('/', async (req, res) => {
  const query = listTasksQuerySchema.parse(req.query);
  res.json(await listTasks(req.userId, query));
});

// Owner/admins: tasks for anyone. Members: tasks for themselves (auto-assigned to them).
taskRoutes.post('/', async (req, res) => {
  const data = createTaskSchema.parse(req.body);
  const task = await createTask(req.userId, data);
  res.status(201).json(task);
});

taskRoutes.get('/:id', async (req, res) => {
  res.json(await getTask(req.userId, req.params.id));
});

// The task's change history (timeline)
taskRoutes.get('/:id/activity', async (req, res) => {
  res.json({ data: await getTaskActivity(req.userId, req.params.id) });
});

// Comments (anyone who can see the task)
taskRoutes.get('/:id/comments', async (req, res) => {
  res.json(await listComments(req.userId, req.params.id));
});

taskRoutes.post('/:id/comments', async (req, res) => {
  const { body, mentionedUserIds } = commentSchema.parse(req.body);
  res.status(201).json(await addComment(req.userId, req.params.id, body, mentionedUserIds));
});

taskRoutes.delete('/:id/comments/:commentId', async (req, res) => {
  await deleteComment(req.userId, req.params.id, req.params.commentId);
  res.status(204).end();
});

// Owner/admins: change anything. Members: tasks they created, or just the status, e.g. { "status": "DONE" }
taskRoutes.patch('/:id', async (req, res) => {
  const data = updateTaskSchema.parse(req.body);
  res.json(await updateTask(req.userId, req.params.id, data));
});

taskRoutes.delete('/:id', async (req, res) => {
  await deleteTask(req.userId, req.params.id);
  res.status(204).end();
});
