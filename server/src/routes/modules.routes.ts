import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { attachmentHeader, openStoredFile, usesObjectStorage, signedDownloadUrl } from '../services/moduleFiles';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

// Learners only ever see PUBLISHED modules. Drafts and archived modules
// answer 404 here exactly like a missing id, so a direct request can't even
// confirm they exist. Authors preview through /api/admin/modules instead.
const PUBLISHED = { status: 'PUBLISHED' } as const;

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const modules = await prisma.module.findMany({
      where: PUBLISHED,
      orderBy: { order: 'asc' },
      include: { lessons: { select: { id: true } }, _count: { select: { files: true } } },
    });

    const completedLessonIds = new Set(
      (await prisma.lessonProgress.findMany({ where: { userId: req.user.id }, select: { lessonId: true } }))
        .map((p) => p.lessonId)
    );

    const data = modules.map(({ lessons, _count, content, createdById, deletedAt, origin, activeTitleKey, ...m }) => ({
      ...m,
      isCustom: origin === 'AUTHORED',
      fileCount: _count.files,
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
    const mod = await prisma.module.findFirst({
      where: { id: String(req.params.id), ...PUBLISHED },
      include: {
        lessons: { orderBy: { order: 'asc' } },
        createdBy: { select: { name: true } },
        files: {
          orderBy: { uploadedAt: 'asc' },
          select: { id: true, originalFileName: true, fileType: true, fileSize: true, extractedText: true, processingStatus: true },
        },
      },
    });
    if (!mod) return res.status(404).json({ success: false, error: 'Module not found' });

    const progress = await prisma.lessonProgress.findMany({
      where: { userId: req.user.id, lessonId: { in: mod.lessons.map((l) => l.id) } },
      select: { lessonId: true, completedAt: true },
    });
    const completedLessonIds = new Set(progress.map((p) => p.lessonId));

    const { createdById, deletedAt, createdBy, origin, activeTitleKey, ...rest } = mod;
    res.json({
      success: true,
      data: {
        ...rest,
        isCustom: origin === 'AUTHORED',
        authorName: createdBy?.name ?? null,
        tags: (mod.tags as string[] | null) ?? [],
        lessons: mod.lessons.map((l) => ({ ...l, completed: completedLessonIds.has(l.id) })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/modules/:id/files/:fileId/download — original learning material,
// only while the module is published.
router.get('/:id/files/:fileId/download', async (req: AuthRequest, res: Response) => {
  try {
    const file = await prisma.moduleFile.findFirst({
      where: { id: String(req.params.fileId), moduleId: String(req.params.id), module: PUBLISHED },
    });
    if (!file) return res.status(404).json({ success: false, error: 'File not found' });
    if (usesObjectStorage()) return res.redirect(302, await signedDownloadUrl(file.storedFileName, file.originalFileName));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', attachmentHeader(file.originalFileName));
    openStoredFile(file.storedFileName)
      .on('error', () => { if (!res.headersSent) res.status(404).json({ success: false, error: 'File not found' }); else res.destroy(); })
      .pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/modules/:moduleId/lessons/:lessonId/complete
router.post('/:moduleId/lessons/:lessonId/complete', async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId, moduleId } = req.params;
    const lesson = await prisma.lesson.findUnique({ where: { id: String(lessonId) }, include: { module: { select: { status: true } } } });
    if (!lesson || lesson.moduleId !== moduleId || lesson.module.status !== 'PUBLISHED') {
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
