import { beforeEach, describe, expect, it } from 'vitest';
import { addMember, createProject, createTask, dateFromToday, loggedInAgent, resetDatabase, teamProject } from './helpers';

beforeEach(resetDatabase);

const titles = (body: { data: { title: string }[] }) => body.data.map((t) => t.title).sort();

describe('Tasks', () => {
  it('creates an unassigned task by default, then updates and deletes it', async () => {
    const agent = await loggedInAgent('alex@example.com', 'Alex');
    const project = await createProject(agent);

    const created = await agent
      .post('/api/tasks')
      .send({ projectId: project.id, title: 'Design homepage', dueDate: '2030-01-15' })
      .expect(201);
    expect(created.body).toMatchObject({
      title: 'Design homepage',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee: null,
      createdBy: { id: agent.userId, name: 'Alex' },
      project: { id: project.id, name: 'My Project' },
    });
    expect(created.body.dueDate).toMatch(/^2030-01-15/);

    const id = created.body.id;
    const updated = await agent.patch(`/api/tasks/${id}`).send({ status: 'DONE' }).expect(200);
    expect(updated.body.status).toBe('DONE');

    await agent.delete(`/api/tasks/${id}`).expect(204);
    await agent.get(`/api/tasks/${id}`).expect(404);
  });

  it('rejects invalid status, priority and date values', async () => {
    const agent = await loggedInAgent('alex@example.com');
    const project = await createProject(agent);

    const res = await agent
      .post('/api/tasks')
      .send({ projectId: project.id, title: 'x', status: 'BLOCKED', priority: 'URGENT', dueDate: 'tomorrow' })
      .expect(400);

    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['status', 'priority', 'dueDate']));
  });

  it('combines search with status and priority filters', async () => {
    const agent = await loggedInAgent('alex@example.com');
    const project = await createProject(agent);
    await createTask(agent, project.id, { title: 'Design homepage', status: 'TODO', priority: 'HIGH' });
    await createTask(agent, project.id, { title: 'Design logo', status: 'DONE', priority: 'HIGH' });
    await createTask(agent, project.id, { title: 'Design footer', status: 'TODO', priority: 'LOW' });
    await createTask(agent, project.id, { title: 'Write tests', status: 'TODO', priority: 'HIGH' });

    const res = await agent.get('/api/tasks?search=design&status=TODO&priority=HIGH').expect(200);
    expect(titles(res.body)).toEqual(['Design homepage']);

    const empty = await agent.get('/api/tasks?search=nothing-matches').expect(200);
    expect(empty.body).toMatchObject({ data: [], meta: { total: 0 } });
  });

  it('filters by due date: overdue and due soon (both exclude done tasks)', async () => {
    const agent = await loggedInAgent('alex@example.com');
    const project = await createProject(agent);
    await createTask(agent, project.id, { title: 'Late', dueDate: dateFromToday(-2) });
    await createTask(agent, project.id, { title: 'Late but done', dueDate: dateFromToday(-2), status: 'DONE' });
    await createTask(agent, project.id, { title: 'Today', dueDate: dateFromToday(0) });
    await createTask(agent, project.id, { title: 'In two days', dueDate: dateFromToday(2) });
    await createTask(agent, project.id, { title: 'Next month', dueDate: dateFromToday(30) });

    const overdue = await agent.get('/api/tasks?due=overdue').expect(200);
    expect(titles(overdue.body)).toEqual(['Late']);

    const soon = await agent.get('/api/tasks?due=soon').expect(200);
    expect(titles(soon.body)).toEqual(['In two days', 'Today']);

    const attention = await agent.get('/api/tasks?due=attention').expect(200);
    expect(titles(attention.body)).toEqual(['In two days', 'Late', 'Today']);
  });

  it('paginates and caps the page size', async () => {
    const agent = await loggedInAgent('alex@example.com');
    const project = await createProject(agent);
    for (let i = 0; i < 5; i++) {
      await createTask(agent, project.id, { title: `Task ${i}` });
    }

    const page2 = await agent.get('/api/tasks?limit=2&page=2').expect(200);
    expect(page2.body.data).toHaveLength(2);
    expect(page2.body.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });

    await agent.get('/api/tasks?limit=1000').expect(400);
  });

  describe('assignees', () => {
    it('assigns a task to a project member and filters by assignee', async () => {
      const { alice, bob, project } = await teamProject();
      await createTask(alice, project.id, { title: 'For Bob', assigneeId: bob.userId });
      await createTask(alice, project.id, { title: 'Nobody yet' });

      const bobs = await alice.get(`/api/tasks?assigneeId=${bob.userId}`).expect(200);
      expect(titles(bobs.body)).toEqual(['For Bob']);
      expect(bobs.body.data[0].assignee).toEqual({ id: bob.userId, name: 'Bob' });

      const unassigned = await alice.get('/api/tasks?assigneeId=unassigned').expect(200);
      expect(titles(unassigned.body)).toEqual(['Nobody yet']);
    });

    it("can't assign a task to someone outside the project", async () => {
      const { alice, project } = await teamProject();
      const outsider = await loggedInAgent('eve@example.com');
      await alice
        .post('/api/tasks')
        .send({ projectId: project.id, title: 'x', dueDate: '2030-01-01', assigneeId: outsider.userId })
        .expect(400);
    });
  });

  describe('visibility and permissions', () => {
    it('the owner sees every task; a member sees only tasks assigned to them', async () => {
      const { alice, bob, project } = await teamProject();
      const carol = await loggedInAgent('carol@example.com', 'Carol');
      await addMember(alice, project.id, carol);

      await createTask(alice, project.id, { title: 'Assigned to Bob', assigneeId: bob.userId });
      await createTask(alice, project.id, { title: 'Assigned to Carol', assigneeId: carol.userId });
      await createTask(alice, project.id, { title: 'Unassigned' });

      const asAlice = await alice.get('/api/tasks').expect(200);
      expect(asAlice.body.meta.total).toBe(3);

      const asBob = await bob.get('/api/tasks').expect(200);
      expect(titles(asBob.body)).toEqual(['Assigned to Bob']);

      // Filtering by someone else's id doesn't bypass the rule.
      const sneaky = await bob.get(`/api/tasks?assigneeId=${carol.userId}`).expect(200);
      expect(sneaky.body.data).toHaveLength(0);
    });

    it("a member can't open, edit or delete a task they can't see (404)", async () => {
      const { alice, bob, project } = await teamProject();
      const task = await createTask(alice, project.id, { title: 'Not for Bob' });

      await bob.get(`/api/tasks/${task.id}`).expect(404);
      await bob.patch(`/api/tasks/${task.id}`).send({ status: 'DONE' }).expect(404);
      await bob.delete(`/api/tasks/${task.id}`).expect(404);
      await bob.get(`/api/tasks/${task.id}/activity`).expect(404);
      await bob.get(`/api/tasks/${task.id}/comments`).expect(404);
    });

    it("someone outside the project can't add tasks to it", async () => {
      const { project } = await teamProject();
      const outsider = await loggedInAgent('eve@example.com');
      await outsider
        .post('/api/tasks')
        .send({ projectId: project.id, title: 'Sneaky', dueDate: '2030-01-01' })
        .expect(404);
    });

    it('a member can only change the status of tasks an admin assigned to them', async () => {
      const { alice, bob, project } = await teamProject();
      const task = await createTask(alice, project.id, { assigneeId: bob.userId });

      await bob.patch(`/api/tasks/${task.id}`).send({ title: 'Renamed' }).expect(403);
      await bob.patch(`/api/tasks/${task.id}`).send({ status: 'IN_PROGRESS', assigneeId: null }).expect(403);
      await bob.patch(`/api/tasks/${task.id}`).send({ status: 'IN_PROGRESS' }).expect(200);
      await bob.delete(`/api/tasks/${task.id}`).expect(403);

      // A promoted admin can do everything
      await alice.patch(`/api/projects/${project.id}/members/${bob.userId}`).send({ role: 'ADMIN' }).expect(200);
      await bob.patch(`/api/tasks/${task.id}`).send({ title: 'Renamed by admin Bob' }).expect(200);
      await bob.delete(`/api/tasks/${task.id}`).expect(204);
    });

    it('a member can create tasks for themselves (always assigned to them) and edit/delete those', async () => {
      const { alice, bob, project } = await teamProject();

      // No assignee given: it's assigned to Bob automatically
      const own = await bob
        .post('/api/tasks')
        .send({ projectId: project.id, title: 'My own task', dueDate: '2030-01-01' })
        .expect(201);
      expect(own.body).toMatchObject({ assignee: { id: bob.userId }, createdBy: { id: bob.userId } });

      // ...but he can't hand work to someone else
      await bob
        .post('/api/tasks')
        .send({ projectId: project.id, title: 'For Alice', dueDate: '2030-01-01', assigneeId: alice.userId })
        .expect(403);
      await bob.patch(`/api/tasks/${own.body.id}`).send({ assigneeId: alice.userId }).expect(403);
      await bob.patch(`/api/tasks/${own.body.id}`).send({ assigneeId: null }).expect(403);

      // He can edit and delete his own task
      await bob.patch(`/api/tasks/${own.body.id}`).send({ title: 'Renamed', priority: 'HIGH' }).expect(200);

      // The owner sees it too
      const asAlice = await alice.get(`/api/tasks/${own.body.id}`).expect(200);
      expect(asAlice.body.title).toBe('Renamed');

      await bob.delete(`/api/tasks/${own.body.id}`).expect(204);
    });
  });

  describe('history', () => {
    it('records creation and every change, newest first, with who made it', async () => {
      const { alice, bob, project } = await teamProject();
      const task = await createTask(alice, project.id, { title: 'Write docs', dueDate: '2030-01-01' });

      await alice.patch(`/api/tasks/${task.id}`).send({ assigneeId: bob.userId, priority: 'HIGH' }).expect(200);
      await bob.patch(`/api/tasks/${task.id}`).send({ status: 'DONE' }).expect(200);
      await alice.patch(`/api/tasks/${task.id}`).send({ dueDate: '2030-02-01' }).expect(200);
      // Sending unchanged values doesn't add an entry.
      await bob.patch(`/api/tasks/${task.id}`).send({ status: 'DONE' }).expect(200);

      const res = await alice.get(`/api/tasks/${task.id}/activity`).expect(200);
      const history = res.body.data;
      expect(history).toHaveLength(4);

      expect(history[0]).toMatchObject({
        action: 'UPDATED',
        actor: { name: 'Alice' },
        changes: [{ field: 'dueDate', from: '2030-01-01', to: '2030-02-01' }],
      });
      expect(history[1]).toMatchObject({
        action: 'UPDATED',
        actor: { name: 'Bob' },
        changes: [{ field: 'status', from: 'TODO', to: 'DONE' }],
      });
      expect(history[2]).toMatchObject({
        action: 'UPDATED',
        actor: { name: 'Alice' },
        changes: [
          { field: 'priority', from: 'MEDIUM', to: 'HIGH' },
          { field: 'assignee', from: null, to: 'Bob' },
        ],
      });
      expect(history[3]).toMatchObject({ action: 'CREATED', actor: { name: 'Alice' } });
    });
  });
});
