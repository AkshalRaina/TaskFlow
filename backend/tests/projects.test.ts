import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, createTask, loggedInAgent, resetDatabase, teamProject } from './helpers';

beforeEach(resetDatabase);

describe('Projects', () => {
  it('creates, reads, updates and deletes a project; the creator is its owner', async () => {
    const agent = await loggedInAgent('alex@example.com');

    const created = await agent
      .post('/api/projects')
      .send({ name: 'Website', description: 'New site' })
      .expect(201);
    expect(created.body).toMatchObject({
      name: 'Website',
      description: 'New site',
      myRole: 'OWNER',
      memberCount: 1,
      totalTasks: 0,
      progress: 0,
    });

    const id = created.body.id;
    await agent.get(`/api/projects/${id}`).expect(200);

    const updated = await agent.patch(`/api/projects/${id}`).send({ name: 'Website v2' }).expect(200);
    expect(updated.body).toMatchObject({ name: 'Website v2', description: 'New site' });

    await agent.delete(`/api/projects/${id}`).expect(204);
    await agent.get(`/api/projects/${id}`).expect(404);
  });

  it('requires a name', async () => {
    const agent = await loggedInAgent('alex@example.com');
    await agent.post('/api/projects').send({ name: '   ' }).expect(400);
  });

  it('includes task counts and completion progress', async () => {
    const agent = await loggedInAgent('alex@example.com');
    const project = await createProject(agent);
    await createTask(agent, project.id, { status: 'DONE' });
    await createTask(agent, project.id, { status: 'DONE' });
    await createTask(agent, project.id, { status: 'TODO' });

    const res = await agent.get('/api/projects').expect(200);
    expect(res.body.data[0]).toMatchObject({ totalTasks: 3, doneTasks: 2, progress: 67 });
  });

  it('deleting a project also deletes its tasks', async () => {
    const agent = await loggedInAgent('alex@example.com');
    const project = await createProject(agent);
    const task = await createTask(agent, project.id);

    await agent.delete(`/api/projects/${project.id}`).expect(204);
    await agent.get(`/api/tasks/${task.id}`).expect(404);
  });

  describe('access', () => {
    it("someone outside the project can't see, change or delete it (404)", async () => {
      const { alice, project } = await teamProject();
      const outsider = await loggedInAgent('eve@example.com');

      // 404 (not 403), so an outsider can't even tell the project exists.
      await outsider.get(`/api/projects/${project.id}`).expect(404);
      await outsider.patch(`/api/projects/${project.id}`).send({ name: 'Hacked' }).expect(404);
      await outsider.delete(`/api/projects/${project.id}`).expect(404);
      await outsider.get(`/api/projects/${project.id}/members`).expect(404);

      const list = await outsider.get('/api/projects').expect(200);
      expect(list.body.data).toHaveLength(0);

      const stillThere = await alice.get(`/api/projects/${project.id}`).expect(200);
      expect(stillThere.body.name).toBe('Team project');
    });

    it("a member can view the project but can't edit or delete it (403)", async () => {
      const { bob, project } = await teamProject();

      const res = await bob.get(`/api/projects/${project.id}`).expect(200);
      expect(res.body).toMatchObject({ myRole: 'MEMBER', memberCount: 2 });

      await bob.patch(`/api/projects/${project.id}`).send({ name: 'Renamed' }).expect(403);
      await bob.delete(`/api/projects/${project.id}`).expect(403);
    });

    it("a member's progress only counts the tasks they can see", async () => {
      const { alice, bob, project } = await teamProject();
      await createTask(alice, project.id, { assigneeId: bob.userId, status: 'DONE' });
      await createTask(alice, project.id, { status: 'TODO' }); // Alice's, unassigned

      const asBob = await bob.get(`/api/projects/${project.id}`).expect(200);
      expect(asBob.body).toMatchObject({ totalTasks: 1, doneTasks: 1, progress: 100 });

      const asAlice = await alice.get(`/api/projects/${project.id}`).expect(200);
      expect(asAlice.body).toMatchObject({ totalTasks: 2, doneTasks: 1, progress: 50 });
    });
  });

  describe('members & roles', () => {
    it('lists members with the owner first', async () => {
      const { alice, bob, project } = await teamProject();

      const res = await bob.get(`/api/projects/${project.id}/members`).expect(200);
      expect(res.body.data).toEqual([
        expect.objectContaining({ userId: alice.userId, role: 'OWNER' }),
        expect.objectContaining({ userId: bob.userId, role: 'MEMBER' }),
      ]);
    });

    it("members can't invite people or change roles", async () => {
      const { bob, project } = await teamProject();

      await bob.post(`/api/projects/${project.id}/invitations`).send({ email: 'carol@example.com' }).expect(403);
      await bob.patch(`/api/projects/${project.id}/members/${bob.userId}`).send({ role: 'ADMIN' }).expect(403);
    });

    it('a promoted member gets admin rights', async () => {
      const { alice, bob, project } = await teamProject();
      await alice.patch(`/api/projects/${project.id}/members/${bob.userId}`).send({ role: 'ADMIN' }).expect(200);
      await bob.patch(`/api/projects/${project.id}`).send({ name: 'Renamed by Bob' }).expect(200);
    });

    it("the owner can't be demoted, removed or leave", async () => {
      const { alice, bob, project } = await teamProject();
      await alice.patch(`/api/projects/${project.id}/members/${bob.userId}`).send({ role: 'ADMIN' }).expect(200);

      // Not even by another admin
      await bob.patch(`/api/projects/${project.id}/members/${alice.userId}`).send({ role: 'MEMBER' }).expect(403);
      await bob.delete(`/api/projects/${project.id}/members/${alice.userId}`).expect(403);
      await alice.delete(`/api/projects/${project.id}/members/${alice.userId}`).expect(403);
      // OWNER can't be handed out
      await alice.patch(`/api/projects/${project.id}/members/${bob.userId}`).send({ role: 'OWNER' }).expect(400);
    });

    it('removing a member unassigns their tasks and they lose access', async () => {
      const { alice, bob, project } = await teamProject();
      const task = await createTask(alice, project.id, { assigneeId: bob.userId });

      await alice.delete(`/api/projects/${project.id}/members/${bob.userId}`).expect(204);

      await bob.get(`/api/projects/${project.id}`).expect(404);
      const after = await alice.get(`/api/tasks/${task.id}`).expect(200);
      expect(after.body.assignee).toBeNull();
    });

    it('a member can leave a project', async () => {
      const { bob, project } = await teamProject();
      await bob.delete(`/api/projects/${project.id}/members/${bob.userId}`).expect(204);
      await bob.get(`/api/projects/${project.id}`).expect(404);
    });
  });
});
