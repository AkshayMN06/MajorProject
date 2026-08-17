import { Router, Response } from 'express';
import { RecommendationEngine } from '../services/recommendationEngine';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = await RecommendationEngine.getUserRecommendations(req.user.id);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    await RecommendationEngine.generateRecommendations(req.user.id);
    const data = await RecommendationEngine.getUserRecommendations(req.user.id);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const data = await RecommendationEngine.markCompleted(String(req.params.id));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
