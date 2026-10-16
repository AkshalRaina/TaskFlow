import { beforeEach, describe, expect, it } from 'vitest';
import { testOutbox } from '../src/email/mailer';
import { createTask, loggedInAgent, resetDatabase, teamProject } from './helpers';

beforeEach(resetDatabase);

describe('Comments', () => {
  it('the assignee and the owner can comment, mention each other, and mentions are emailed', async () => {
    const { alice, bob, project } = await teamProject();
    const task = await createTask(alice, project.id, { title: 'Design homepage', assigneeId: bob.userId });

    const list = await bob.get(`/api/tasks/${task.id}/comments`).expect(200);
    // Who can be tagged: people who can see the task (owner + assignee).
    expect(list.body.mentionable.map((u: { name: string }) => u.name).sort()).toEqual(['Alice', 'Bob']);

    const created = await bob
      .post(`/api/tasks/${task.id}/comments`)
      .send({ body: '@Alice the header is done, can you review?', mentionedUserIds: [alice.userId] })
      .expect(201);
    expect(created.body).toMatchObject({ author: { name: 'Bob' }, mentions: [{ id: alice.userId, name: 'Alice' }] });

    const email = testOutbox.at(-1)!;
    expect(email.to).toBe('alice@example.com');
    expect(email.subject).toBe('Bob mentioned you on "Design homepage"');
    expect(email.text).toContain(`/tasks/${task.id}`);

    await alice.post(`/api/tasks/${task.id}/comments`).send({ body: 'Looks great!' }).expect(201);

    const after = await alice.get(`/api/tasks/${task.id}/comments`).expect(200);
    expect(after.body.data.map((c: { body: string }) => c.body)).toEqual([
      '@Alice the header is done, can you review?',
      'Looks great!',
    ]);
  });

  it('anyone in the project can be tagged; a tagged member can then read and comment, but not change the task', async () => {
    const { alice, bob, project } = await teamProject();
    // Alice's own task: Bob isn't the assignee, so normally he can't see it.
    const task = await createTask(alice, project.id, { title: 'Budget review', assigneeId: alice.userId });
    await bob.get(`/api/tasks/${task.id}`).expect(404);

    const list = await alice.get(`/api/tasks/${task.id}/comments`).expect(200);
    expect(list.body.mentionable.map((u: { name: string }) => u.name).sort()).toEqual(['Alice', 'Bob']);

    await alice
      .post(`/api/tasks/${task.id}/comments`)
      .send({ body: '@Bob can you check the numbers?', mentionedUserIds: [bob.userId] })
      .expect(201);
    expect(testOutbox.at(-1)!.to).toBe('bob@example.com');

    // Now Bob can open it, read the history and comments, and reply...
    await bob.get(`/api/tasks/${task.id}`).expect(200);
    await bob.get(`/api/tasks/${task.id}/activity`).expect(200);
    await bob.get(`/api/tasks/${task.id}/comments`).expect(200);
    await bob.post(`/api/tasks/${task.id}/comments`).send({ body: 'Looks right to me.' }).expect(201);

    // ...but it isn't his task: no changes, and it doesn't show up in his task list.
    await bob.patch(`/api/tasks/${task.id}`).send({ status: 'DONE' }).expect(403);
    await bob.delete(`/api/tasks/${task.id}`).expect(403);
    const bobsTasks = await bob.get('/api/tasks').expect(200);
    expect(bobsTasks.body.data).toHaveLength(0);
  });

  it("can't mention someone outside the project, and leaving the project removes tagged access", async () => {
    const { alice, bob, project } = await teamProject();
    const outsider = await loggedInAgent('eve@example.com');
    const task = await createTask(alice, project.id);

    await alice
      .post(`/api/tasks/${task.id}/comments`)
      .send({ body: '@Eve hi', mentionedUserIds: [outsider.userId] })
      .expect(400);
    await outsider.get(`/api/tasks/${task.id}`).expect(404);

    await alice.post(`/api/tasks/${task.id}/comments`).send({ body: '@Bob hi', mentionedUserIds: [bob.userId] }).expect(201);
    await bob.get(`/api/tasks/${task.id}`).expect(200);
    await alice.delete(`/api/projects/${project.id}/members/${bob.userId}`).expect(204);
    await bob.get(`/api/tasks/${task.id}`).expect(404);
  });

  it('rejects empty comments', async () => {
    const { alice, project } = await teamProject();
    const task = await createTask(alice, project.id);
    await alice.post(`/api/tasks/${task.id}/comments`).send({ body: '   ' }).expect(400);
  });

  it('authors delete their own comments; owners/admins can delete any', async () => {
    const { alice, bob, project } = await teamProject();
    const task = await createTask(alice, project.id, { assigneeId: bob.userId });

    const byAlice = await alice.post(`/api/tasks/${task.id}/comments`).send({ body: 'From Alice' }).expect(201);
    const byBob = await bob.post(`/api/tasks/${task.id}/comments`).send({ body: 'From Bob' }).expect(201);

    await bob.delete(`/api/tasks/${task.id}/comments/${byAlice.body.id}`).expect(403);
    await bob.delete(`/api/tasks/${task.id}/comments/${byBob.body.id}`).expect(204);
    await alice.delete(`/api/tasks/${task.id}/comments/${byAlice.body.id}`).expect(204);
  });
});
