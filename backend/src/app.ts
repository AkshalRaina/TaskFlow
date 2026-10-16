import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { config } from './config';
import { prisma } from './db';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { invitationRoutes } from './modules/invitations/invitations.routes';
import { projectRoutes } from './modules/projects/projects.routes';
import { taskRoutes } from './modules/tasks/tasks.routes';

// The app is built here without calling listen(), so tests can use it directly.
export const app = express();

// API docs (Swagger UI). Registered before helmet because the UI needs inline scripts.
const openApiDoc = YAML.parse(fs.readFileSync(path.join(__dirname, '../docs/openapi.yaml'), 'utf8'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));

app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
// Request logs: short and colored in development, standard Apache "combined" format in production.
if (!config.isTest) {
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
}

// Used by Docker / load balancers to check that this instance can reach the database.
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes); // viewing a link is public; accepting needs a login
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
