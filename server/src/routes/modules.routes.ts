import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const modules = await prisma.module.findMany({
      orderBy: { order: 'asc' },
      include: { lessons: { select: { id: true } } },
    });

    const completedLessonIds = new Set(
      (await prisma.lessonProgress.findMany({ where: { userId: req.user.id }, select: { lessonId: true } }))
        .map((p) => p.lessonId)
    );

    const data = modules.map(({ lessons, ...m }) => ({
      ...m,
      lessonCount: lessons.length,
      completedLessonCount: lessons.filter((l) => completedLessonIds.has(l.id)).length,
    }));

    res.json({ success: true, data });
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

    const progress = await prisma.lessonProgress.findMany({
      where: { userId: req.user.id, lessonId: { in: mod.lessons.map((l) => l.id) } },
      select: { lessonId: true, completedAt: true },
    });
    const completedLessonIds = new Set(progress.map((p) => p.lessonId));

    res.json({
      success: true,
      data: {
        ...mod,
        lessons: mod.lessons.map((l) => ({ ...l, completed: completedLessonIds.has(l.id) })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/modules/:moduleId/lessons/:lessonId/complete
router.post('/:moduleId/lessons/:lessonId/complete', async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId, moduleId } = req.params;
    const lesson = await prisma.lesson.findUnique({ where: { id: String(lessonId) } });
    if (!lesson || lesson.moduleId !== moduleId) {
      return res.status(404).json({ success: false, error: 'Lesson not found in this module' });
    }

    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: req.user.id, lessonId: String(lessonId) } },
      update: {},
      create: { userId: req.user.id, lessonId: String(lessonId) },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
