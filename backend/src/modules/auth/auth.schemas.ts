import { z } from 'zod';

// Trim + lowercase first, then check the format, so " Alex@Mail.com " and "alex@mail.com" are the same account.
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email,
  // bcrypt only uses the first 72 bytes of a password.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  // Set when registering from an invitation link: the new account joins that project right away.
  inviteToken: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});
