import { Router } from 'express';
import { inviteToProject, listInvitations, revokeInvitation } from '../invitations/invitations.service';
import { changeMemberRole, listMembers, removeMember } from './members.service';
import { changeRoleSchema, createProjectSchema, inviteSchema, updateProjectSchema } from './projects.schemas';
import { createProject, deleteProject, getProject, listProjects, updateProject } from './projects.service';

// Mounted behind `requireAuth`, so `req.userId` is always set here.
export const projectRoutes = Router();

//My projects, each with my role, member count and progress %
projectRoutes.get('/', async (req, res) => {
  const projects = await listProjects(req.userId);
  res.json({ data: projects });
});

// Creates a project. The creator becomes OWNER
projectRoutes.post('/', async (req, res) => {
  const data = createProjectSchema.parse(req.body);
  const project = await createProject(req.userId, data);
  res.status(201).json(project);
});

//One project with its stats
projectRoutes.get('/:id', async (req, res) => {
  const project = await getProject(req.userId, req.params.id);
  res.json(project);
});

// Edits name or description
projectRoutes.patch('/:id', async (req, res) => {
  const data = updateProjectSchema.parse(req.body);
  const project = await updateProject(req.userId, req.params.id, data);
  res.json(project);
});

// Deletes the project. The DB cascades the delete to members, tasks, history and comments
projectRoutes.delete('/:id', async (req, res) => {
  await deleteProject(req.userId, req.params.id);
  res.status(204).end();
});

// ---- Members & roles ----

//Lists members, sorted owner → admins → members
projectRoutes.get('/:id/members', async (req, res) => {
  res.json({ data: await listMembers(req.userId, req.params.id) });
});

// Owner/admin only: make someone an admin or a member
//Changes a role to ADMIN or MEMBER. The owner's role can't be changed

projectRoutes.patch('/:id/members/:userId', async (req, res) => {
  const { role } = changeRoleSchema.parse(req.body);
  res.json(await changeMemberRole(req.userId, req.params.id, req.params.userId, role));
});

// Owner/admin: remove anyone but the owner. Anyone but the owner: remove yourself (leave).
// Removes a member, or lets you leave. Their tasks become unassigned

projectRoutes.delete('/:id/members/:userId', async (req, res) => {
  await removeMember(req.userId, req.params.id, req.params.userId);
  res.status(204).end();
});

// ---- Invitations (owner/admin only) ----

projectRoutes.get('/:id/invitations', async (req, res) => {
  res.json({ data: await listInvitations(req.userId, req.params.id) });
});

// Emails a link to join the project. Inviting the same email again sends a fresh link.
// Creates an invite token and emails the link.
//  Re-inviting the same email replaces the old link

projectRoutes.post('/:id/invitations', async (req, res) => {
  const { email, role } = inviteSchema.parse(req.body);
  res.status(201).json(await inviteToProject(req.userId, req.params.id, email, role));
});


//Revokes a pending invite
projectRoutes.delete('/:id/invitations/:invitationId', async (req, res) => {
  await revokeInvitation(req.userId, req.params.id, req.params.invitationId);
  res.status(204).end();
});
