import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { testOutbox } from '../src/email/mailer';

export async function resetDatabase() {
  await prisma.taskComment.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectInvitation.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  testOutbox.length = 0;
}

/**
 * Registers a user and returns a supertest "agent" plus the user's id.
 * The agent keeps cookies between requests, just like a browser, so it stays logged in.
 */
export async function loggedInAgent(email: string, name = 'Test User') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name, email, password: 'password123' }).expect(201);
  return Object.assign(agent, { userId: res.body.id as string, email });
}

export type Agent = Awaited<ReturnType<typeof loggedInAgent>>;

export async function createProject(agent: Agent, name = 'My Project') {
  const res = await agent.post('/api/projects').send({ name }).expect(201);
  return res.body as { id: string };
}

/** The invite token from the last email sent to `email` (tests read emails from the in-memory outbox). */
export function lastInviteToken(email: string): string {
  const message = [...testOutbox].reverse().find((m) => m.to === email);
  const token = message?.text.match(/\/invite\/([\w-]+)/)?.[1];
  if (!token) throw new Error(`No invitation email found for ${email}`);
  return token;
}

/** `admin` invites `user`, and `user` accepts from the emailed link. */
export async function addMember(admin: Agent, projectId: string, user: Agent, role = 'MEMBER') {
  await admin.post(`/api/projects/${projectId}/invitations`).send({ email: user.email, role }).expect(201);
  await user.post(`/api/invitations/${lastInviteToken(user.email)}/accept`).expect(200);
}

export async function createTask(agent: Agent, projectId: string, overrides: Record<string, unknown> = {}) {
  const res = await agent
    .post('/api/tasks')
    .send({ projectId, title: 'A task', dueDate: '2030-01-01', ...overrides })
    .expect(201);
  return res.body as { id: string };
}

/** "YYYY-MM-DD" for `offset` days from today (UTC). */
export function dateFromToday(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * A common setup: Alice creates a project (so she's its owner) and Bob joins it as a member.
 */
export async function teamProject() {
  const alice = await loggedInAgent('alice@example.com', 'Alice');
  const bob = await loggedInAgent('bob@example.com', 'Bob');
  const project = await createProject(alice, 'Team project');
  await addMember(alice, project.id, bob);
  return { alice, bob, project };
}
