import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { loggedInAgent, resetDatabase } from './helpers';

beforeEach(resetDatabase);

describe('Auth', () => {
  it('registers a user, sets an httpOnly cookie and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alex', email: 'Alex@Example.com ', password: 'password123' })
      .expect(201);

    expect(res.body).toMatchObject({ name: 'Alex', email: 'alex@example.com' });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.headers['set-cookie'][0]).toMatch(/token=.+HttpOnly/);
  });

  it('rejects a duplicate email with 409', async () => {
    await loggedInAgent('alex@example.com');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alex', email: 'alex@example.com', password: 'password123' })
      .expect(409);

    expect(res.body.error.message).toMatch(/already exists/);
  });

  it('returns field-level validation errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' })
      .expect(400);

    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('rejects a wrong password with 401', async () => {
    await loggedInAgent('alex@example.com');
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex@example.com', password: 'wrong-password' })
      .expect(401);
  });

  it('logs in with the correct password', async () => {
    await loggedInAgent('alex@example.com');
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'alex@example.com', password: 'password123' }).expect(200);
    await agent.get('/api/auth/me').expect(200);
  });

  it('blocks protected routes without a session', async () => {
    await request(app).get('/api/projects').expect(401);
    await request(app).get('/api/tasks').expect(401);
    await request(app).get('/api/dashboard').expect(401);
    await request(app).get('/api/projects').set('Cookie', 'token=forged.jwt.value').expect(401);
  });

  it('logs out by clearing the cookie', async () => {
    const agent = await loggedInAgent('alex@example.com');
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
});
