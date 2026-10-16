import { Router } from 'express';
import { getDashboardStats } from './dashboard.service';

// Mounted behind `requireAuth`, so `req.userId` is always set here.
export const dashboardRoutes = Router();

dashboardRoutes.get('/', async (req, res) => {
  res.json(await getDashboardStats(req.userId));
});
