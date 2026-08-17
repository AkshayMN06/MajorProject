import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const modules = await prisma.module.findMany({
      orderBy: { order: 'asc' }
    });
    res.json({ success: true, data: modules });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const mod = await prisma.module.findUnique({
      where: { id: String(req.params.id) },
      include: {
        lessons: {
          orderBy: { order: 'asc' }
        }
      }
    });
    if (!mod) return res.status(404).json({ success: false, error: 'Module not found' });
    res.json({ success: true, data: mod });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
