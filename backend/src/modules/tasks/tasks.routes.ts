import { Router } from 'express';
import { addComment, deleteComment, listComments } from './comments.service';
import { commentSchema, createTaskSchema, listTasksQuerySchema, updateTaskSchema } from './tasks.schemas';
import { createTask, deleteTask, getTask, getTaskActivity, listTasks, updateTask } from './tasks.service';

// Mounted behind `requireAuth`, so `req.userId` is always set here.
export const taskRoutes = Router();

// Lists tasks in the project with filters and pagination
// For members: only tasks assigned to them
taskRoutes.get('/', async (req, res) => {
  const query = listTasksQuerySchema.parse(req.query);
  res.json(await listTasks(req.userId, query));
});

// Creates a task. Assigns it to the creator if they are a member.
taskRoutes.post('/', async (req, res) => {
  const data = createTaskSchema.parse(req.body);
  const task = await createTask(req.userId, data);
  res.status(201).json(task);
});

// Task details
taskRoutes.get('/:id', async (req, res) => {
  res.json(await getTask(req.userId, req.params.id));
});

// The task's change history (timeline)
//Change history, newest first

taskRoutes.get('/:id/activity', async (req, res) => {
  res.json({ data: await getTaskActivity(req.userId, req.params.id) });
});

// Comments (anyone who can see the task)
//Comments, plus the list of people who can be @mentioned

taskRoutes.get('/:id/comments', async (req, res) => {
  res.json(await listComments(req.userId, req.params.id));
});

//Adds a comment with @mentions and emails each person mentioned

taskRoutes.post('/:id/comments', async (req, res) => {
  const { body, mentionedUserIds } = commentSchema.parse(req.body);
  res.status(201).json(await addComment(req.userId, req.params.id, body, mentionedUserIds));
});

//Deletes a comment
//Author or Admin	
taskRoutes.delete('/:id/comments/:commentId', async (req, res) => {
  await deleteComment(req.userId, req.params.id, req.params.commentId);
  res.status(204).end();
});

// Owner/admins: change anything. Members: tasks they created, or just the status, e.g. { "status": "DONE" }
//Updates the task and records only the fields that actually changed

taskRoutes.patch('/:id', async (req, res) => {
  const data = updateTaskSchema.parse(req.body);
  res.json(await updateTask(req.userId, req.params.id, data));
});

// Deletes the task
// Admin, or own task	
taskRoutes.delete('/:id', async (req, res) => {
  await deleteTask(req.userId, req.params.id);
  res.status(204).end();
});
