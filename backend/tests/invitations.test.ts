import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { testOutbox } from '../src/email/mailer';
import { createProject, lastInviteToken, loggedInAgent, resetDatabase } from './helpers';

beforeEach(resetDatabase);

async function ownerWithProject() {
  const alice = await loggedInAgent('alice@example.com', 'Alice');
  const project = await createProject(alice, 'Launch');
  return { alice, project };
}

describe('Invitations', () => {
  it('emails a one-day link, and a new person registers through it and joins the project', async () => {
    const { alice, project } = await ownerWithProject();

    const invite = await alice
      .post(`/api/projects/${project.id}/invitations`)
      .send({ email: 'New.Person@Example.com', role: 'ADMIN' })
      .expect(201);
    expect(invite.body).toMatchObject({ emailSent: true, invitation: { email: 'new.person@example.com', role: 'ADMIN', status: 'pending' } });

    const hoursValid = (new Date(invite.body.invitation.expiresAt).getTime() - Date.now()) / 3_600_000;
    expect(hoursValid).toBeGreaterThan(23.9);
    expect(hoursValid).toBeLessThanOrEqual(24);

    const email = testOutbox.at(-1)!;
    expect(email.to).toBe('new.person@example.com');
    expect(email.subject).toContain('Alice invited you to "Launch"');
    const token = lastInviteToken('new.person@example.com');

    // The invite page can read the link without logging in.
    const info = await request(app).get(`/api/invitations/${token}`).expect(200);
    expect(info.body).toMatchObject({ project: { name: 'Launch' }, invitedBy: 'Alice', status: 'pending', accountExists: false });

    const newcomer = request.agent(app);
    const registered = await newcomer
      .post('/api/auth/register')
      .send({ name: 'Nina', email: 'new.person@example.com', password: 'password123', inviteToken: token })
      .expect(201);
    expect(registered.body.joinedProject).toEqual({ project: { id: project.id, name: 'Launch' }, role: 'ADMIN' });

    const joined = await newcomer.get(`/api/projects/${project.id}`).expect(200);
    expect(joined.body.myRole).toBe('ADMIN');

    // The link works only once.
    await request(app).get(`/api/invitations/${token}`).expect(200).expect((res) => expect(res.body.status).toBe('accepted'));
    await newcomer.post(`/api/invitations/${token}/accept`).expect(409);
  });

  it('an existing user accepts after signing in', async () => {
    const { alice, project } = await ownerWithProject();
    const bob = await loggedInAgent('bob@example.com', 'Bob');

    await alice.post(`/api/projects/${project.id}/invitations`).send({ email: 'bob@example.com' }).expect(201);
    const token = lastInviteToken('bob@example.com');

    const info = await request(app).get(`/api/invitations/${token}`).expect(200);
    expect(info.body.accountExists).toBe(true);

    const accepted = await bob.post(`/api/invitations/${token}/accept`).expect(200);
    expect(accepted.body).toEqual({ project: { id: project.id, name: 'Launch' }, role: 'MEMBER' });
    await bob.get(`/api/projects/${project.id}`).expect(200);
  });

  it('only works for the invited email address', async () => {
    const { alice, project } = await ownerWithProject();
    const eve = await loggedInAgent('eve@example.com');

    await alice.post(`/api/projects/${project.id}/invitations`).send({ email: 'bob@example.com' }).expect(201);
    const token = lastInviteToken('bob@example.com');

    await eve.post(`/api/invitations/${token}/accept`).expect(403);
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Eve 2', email: 'eve2@example.com', password: 'password123', inviteToken: token })
      .expect(403);
    // The failed registration didn't create an account.
    expect(await prisma.user.findUnique({ where: { email: 'eve2@example.com' } })).toBeNull();
  });

  it('expires after a day', async () => {
    const { alice, project } = await ownerWithProject();
    const bob = await loggedInAgent('bob@example.com');
    await alice.post(`/api/projects/${project.id}/invitations`).send({ email: 'bob@example.com' }).expect(201);
    const token = lastInviteToken('bob@example.com');

    // Pretend a day has passed.
    await prisma.projectInvitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const info = await request(app).get(`/api/invitations/${token}`).expect(200);
    expect(info.body.status).toBe('expired');
    await bob.post(`/api/invitations/${token}/accept`).expect(410);
  });

  it('inviting again replaces the old link; revoking cancels it', async () => {
    const { alice, project } = await ownerWithProject();
    const bob = await loggedInAgent('bob@example.com');

    await alice.post(`/api/projects/${project.id}/invitations`).send({ email: 'bob@example.com' }).expect(201);
    const oldToken = lastInviteToken('bob@example.com');
    await alice.post(`/api/projects/${project.id}/invitations`).send({ email: 'bob@example.com' }).expect(201);
    const newToken = lastInviteToken('bob@example.com');

    await bob.post(`/api/invitations/${oldToken}/accept`).expect(404);

    const pending = await alice.get(`/api/projects/${project.id}/invitations`).expect(200);
    expect(pending.body.data).toHaveLength(1);

    await alice.delete(`/api/projects/${project.id}/invitations/${pending.body.data[0].id}`).expect(204);
    await bob.post(`/api/invitations/${newToken}/accept`).expect(404);
  });

  it("rejects inviting someone who's already a member, and unknown links", async () => {
    const { alice, project } = await ownerWithProject();
    await alice.post(`/api/projects/${project.id}/invitations`).send({ email: 'alice@example.com' }).expect(409);
    await request(app).get('/api/invitations/not-a-real-token').expect(404);
  });

  it("stores only a hash of the token, never the token itself", async () => {
    const { alice, project } = await ownerWithProject();
    await alice.post(`/api/projects/${project.id}/invitations`).send({ email: 'bob@example.com' }).expect(201);
    const token = lastInviteToken('bob@example.com');

    const row = await prisma.projectInvitation.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
