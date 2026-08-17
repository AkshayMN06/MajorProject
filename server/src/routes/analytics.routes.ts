import { Router, Response } from 'express';
import { AnalyticsEngine } from '../services/analyticsEngine';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = await AnalyticsEngine.getUserAnalytics(req.user.id);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const data = await AnalyticsEngine.getAnalyticsSummary(req.user.id);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/trends', async (req: AuthRequest, res: Response) => {
  try {
    const data = await AnalyticsEngine.getPerformanceTrends(req.user.id);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const data = await AnalyticsEngine.getCategoryAccuracy(req.user.id);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/activity', async (req: AuthRequest, res: Response) => {
  try {
    const data = await AnalyticsEngine.getRecentActivity(req.user.id);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
