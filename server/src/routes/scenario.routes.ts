import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;
    const scenarios = await prisma.scenario.findMany({
      where: category ? { category: String(category) } : undefined,
    });
    res.json({ success: true, data: scenarios });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/scenarios/categories — distinct scenario categories, used as
// the "Assessment Module" picker on session creation.
router.get('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const scenarios = await prisma.scenario.findMany({ select: { category: true }, distinct: ['category'] });
    res.json({ success: true, data: scenarios.map((s) => s.category).sort() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const scenario = await prisma.scenario.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!scenario) return res.status(404).json({ success: false, error: 'Scenario not found' });
    res.json({ success: true, data: scenario });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
