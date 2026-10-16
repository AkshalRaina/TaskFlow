import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, createTask, dateFromToday, loggedInAgent, resetDatabase, teamProject } from './helpers';

beforeEach(resetDatabase);

describe('Dashboard', () => {
  it('returns zeros for a new user', async () => {
    const agent = await loggedInAgent('alex@example.com');
    const res = await agent.get('/api/dashboard').expect(200);
    expect(res.body).toMatchObject({
      totalProjects: 0,
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      attention: { total: 0, tasks: [] },
    });
  });

  it('counts tasks by status and only treats unfinished past-due tasks as overdue', async () => {
    const agent = await loggedInAgent('alex@example.com');
    const p1 = await createProject(agent, 'One');
    const p2 = await createProject(agent, 'Two');

    await createTask(agent, p1.id, { status: 'TODO', dueDate: dateFromToday(-3) }); // overdue
    await createTask(agent, p1.id, { status: 'IN_PROGRESS', dueDate: dateFromToday(-1) }); // overdue
    await createTask(agent, p1.id, { status: 'DONE', dueDate: dateFromToday(-5) }); // done, so NOT overdue
    await createTask(agent, p2.id, { status: 'TODO', dueDate: dateFromToday(0) }); // due today, NOT overdue
    await createTask(agent, p2.id, { status: 'DONE', dueDate: dateFromToday(10) });

    const res = await agent.get('/api/dashboard').expect(200);
    expect(res.body).toMatchObject({
      totalProjects: 2,
      totalTasks: 5,
      completedTasks: 2,
      overdueTasks: 2,
      completionRate: 40,
      tasksByStatus: { TODO: 2, IN_PROGRESS: 1, DONE: 2 },
    });
  });

  it('lists tasks needing attention: unfinished, overdue or due within 3 days, most urgent first', async () => {
    const agent = await loggedInAgent('alex@example.com');
    const project = await createProject(agent);
    await createTask(agent, project.id, { title: 'Due in 2 days', dueDate: dateFromToday(2) });
    await createTask(agent, project.id, { title: 'Overdue', dueDate: dateFromToday(-1) });
    await createTask(agent, project.id, { title: 'Overdue but done', dueDate: dateFromToday(-1), status: 'DONE' });
    await createTask(agent, project.id, { title: 'Next week', dueDate: dateFromToday(7) });

    const res = await agent.get('/api/dashboard').expect(200);
    expect(res.body.attention.total).toBe(2);
    expect(res.body.attention.tasks.map((t: { title: string }) => t.title)).toEqual(['Overdue', 'Due in 2 days']);
  });

  it("a member's dashboard only counts their tasks; the admin's counts the whole team", async () => {
    const { alice, bob, project } = await teamProject();
    await createTask(alice, project.id, { title: "Bob's", assigneeId: bob.userId, dueDate: dateFromToday(-1) });
    await createTask(alice, project.id, { title: 'Unassigned', dueDate: dateFromToday(1) });

    const asBob = await bob.get('/api/dashboard').expect(200);
    expect(asBob.body).toMatchObject({ totalProjects: 1, totalTasks: 1, overdueTasks: 1 });
    expect(asBob.body.attention.tasks.map((t: { title: string }) => t.title)).toEqual(["Bob's"]);

    const asAlice = await alice.get('/api/dashboard').expect(200);
    expect(asAlice.body).toMatchObject({ totalProjects: 1, totalTasks: 2, overdueTasks: 1 });
    expect(asAlice.body.attention.total).toBe(2);
  });

  it('lists the latest comments that mention you, without counting those tasks as yours', async () => {
    const { alice, bob, project } = await teamProject();
    const task = await createTask(alice, project.id, { title: 'Budget review', assigneeId: alice.userId });
    await alice
      .post(`/api/tasks/${task.id}/comments`)
      .send({ body: '@Bob can you check this?', mentionedUserIds: [bob.userId] })
      .expect(201);

    const res = await bob.get('/api/dashboard').expect(200);
    expect(res.body.totalTasks).toBe(0);
    expect(res.body.mentions).toEqual([
      expect.objectContaining({
        body: '@Bob can you check this?',
        author: { id: alice.userId, name: 'Alice' },
        task: { id: task.id, title: 'Budget review', project: { name: 'Team project' } },
      }),
    ]);
  });

  it("does not count projects the user isn't in", async () => {
    const alice = await loggedInAgent('alice@example.com');
    const outsider = await loggedInAgent('eve@example.com');
    const project = await createProject(alice);
    await createTask(alice, project.id, { dueDate: dateFromToday(-1) });

    const res = await outsider.get('/api/dashboard').expect(200);
    expect(res.body).toMatchObject({ totalProjects: 0, totalTasks: 0, overdueTasks: 0 });
  });
});
