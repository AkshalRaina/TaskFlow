import { Router } from 'express';
import { inviteToProject, listInvitations, revokeInvitation } from '../invitations/invitations.service';
import { changeMemberRole, listMembers, removeMember } from './members.service';
import { changeRoleSchema, createProjectSchema, inviteSchema, updateProjectSchema } from './projects.schemas';
import { createProject, deleteProject, getProject, listProjects, updateProject } from './projects.service';

// Mounted behind `requireAuth`, so `req.userId` is always set here.
export const projectRoutes = Router();

projectRoutes.get('/', async (req, res) => {
  const projects = await listProjects(req.userId);
  res.json({ data: projects });
});

// Anyone can create a project; they become its owner.
projectRoutes.post('/', async (req, res) => {
  const data = createProjectSchema.parse(req.body);
  const project = await createProject(req.userId, data);
  res.status(201).json(project);
});

projectRoutes.get('/:id', async (req, res) => {
  const project = await getProject(req.userId, req.params.id);
  res.json(project);
});

// Owner/admin only
projectRoutes.patch('/:id', async (req, res) => {
  const data = updateProjectSchema.parse(req.body);
  const project = await updateProject(req.userId, req.params.id, data);
  res.json(project);
});

// Owner/admin only
projectRoutes.delete('/:id', async (req, res) => {
  await deleteProject(req.userId, req.params.id);
  res.status(204).end();
});

// ---- Members & roles ----

projectRoutes.get('/:id/members', async (req, res) => {
  res.json({ data: await listMembers(req.userId, req.params.id) });
});

// Owner/admin only: make someone an admin or a member
projectRoutes.patch('/:id/members/:userId', async (req, res) => {
  const { role } = changeRoleSchema.parse(req.body);
  res.json(await changeMemberRole(req.userId, req.params.id, req.params.userId, role));
});

// Owner/admin: remove anyone but the owner. Anyone but the owner: remove yourself (leave).
projectRoutes.delete('/:id/members/:userId', async (req, res) => {
  await removeMember(req.userId, req.params.id, req.params.userId);
  res.status(204).end();
});

// ---- Invitations (owner/admin only) ----

projectRoutes.get('/:id/invitations', async (req, res) => {
  res.json({ data: await listInvitations(req.userId, req.params.id) });
});

// Emails a link to join the project. Inviting the same email again sends a fresh link.
projectRoutes.post('/:id/invitations', async (req, res) => {
  const { email, role } = inviteSchema.parse(req.body);
  res.status(201).json(await inviteToProject(req.userId, req.params.id, email, role));
});

projectRoutes.delete('/:id/invitations/:invitationId', async (req, res) => {
  await revokeInvitation(req.userId, req.params.id, req.params.invitationId);
  res.status(204).end();
});
