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

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const scenario = await prisma.scenario.findUnique({
      where: { id: req.params.id },
      include: {
        attackOptions: true,
        defenseOptions: true,
      }
    });
    if (!scenario) return res.status(404).json({ success: false, error: 'Scenario not found' });
    res.json({ success: true, data: scenario });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
