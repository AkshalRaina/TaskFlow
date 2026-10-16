import { PrismaClient } from '@prisma/client';

// One shared client (and connection pool) for the whole app.
export const prisma = new PrismaClient();
