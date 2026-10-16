import { z } from 'zod';

const name = z.string().trim().min(1, 'Name is required').max(100);
const description = z.string().trim().max(1000);

export const createProjectSchema = z.object({
  name,
  description: description.default(''),
});

// Every field is optional on update; only the fields sent are changed.
export const updateProjectSchema = z.object({
  name: name.optional(),
  description: description.optional(),
});

// The OWNER role can't be given away: there is exactly one owner, the creator.
const assignableRole = z.enum(['ADMIN', 'MEMBER']);

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  role: assignableRole.default('MEMBER'),
});

export const changeRoleSchema = z.object({ role: assignableRole });
