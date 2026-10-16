import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { prisma } from '../../db';
import { AppError } from '../../utils/AppError';

export const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 1 day

const BCRYPT_ROUNDS = 10;

// Never send the password hash back to the client.
const publicUserFields = { id: true, name: true, email: true, createdAt: true } as const;

export async function registerUser(name: string, email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return prisma.user.create({
    data: { name, email, passwordHash },
    select: publicUserFields,
  });
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

  // Same message for "no such user" and "wrong password", so the API doesn't reveal which emails are registered.
  if (!user || !passwordMatches) {
    throw new AppError(401, 'Invalid email or password');
  }

  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

export function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: publicUserFields });
}

export function createToken(userId: string) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: TOKEN_TTL_SECONDS });
}
