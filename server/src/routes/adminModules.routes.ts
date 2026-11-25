import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { Prisma, PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireModuleManager } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';
import { env } from '../config/env';
import {
  createModuleSchema, updateModuleSchema, archiveModuleSchema, uploadUrlsSchema, uploadCompleteSchema, DIFFICULTY_FROM_LABEL, type ModuleInput,
} from '../validation/moduleSchemas';
import {
  validateUpload, extractText, storeFile, removeStoredFile, openStoredFile, attachmentHeader, FileRejection, MAX_FILES_PER_UPLOAD,
  usesObjectStorage, signedDownloadUrl, createUploadTarget, readStagedUpload, promoteStagedUpload, discardStagedUpload,
  type UploadTarget, type ModuleFileType,
} from '../services/moduleFiles';

// Teacher/Admin Module Management — /api/admin/modules.
// Any teacher or admin may view every module (including drafts). Changes
// are limited to AUTHORED modules: teachers manage their own, admins manage
// all (including modules whose author account was deleted). BUILTIN
// curriculum is read-only here; it is maintained in prisma/moduleData.ts.
//
// Lifecycle invariants (no edits after archive, published modules always
// have learning material, unique active titles) hold under concurrent
// requests: every change runs in withModuleLock, and titles are unique in
// the database via Module.activeTitleKey.
const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);
router.use(requireModuleManager);

const STATUS = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' } as const;
const CONTENT_LESSON_TITLE = 'Learning Material';
type Db = Prisma.TransactionClient;
type User = { id: string; role: string };

class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

function handleError(res: Response, err: any) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err?.code === 'P2002' && String(err?.meta?.target ?? '').includes('activeTitleKey')) {
    return res.status(409).json({ success: false, error: 'A module with this title already exists. Choose a different title.' });
  }
  console.error('[adminModules]', err);
  res.status(500).json({ success: false, error: 'Something went wrong while managing the module.' });
}

const fileSelect = {
  id: true, originalFileName: true, fileType: true, mimeType: true, fileSize: true,
  extractedText: true, processingStatus: true, processingNote: true, uploadedAt: true,
} as const; // storedFileName is deliberately never selected for responses

const moduleInclude = {
  createdBy: { select: { id: true, name: true } },
  lessons: { select: { id: true, title: true, content: true, order: true }, orderBy: { order: 'asc' as const } },
  _count: { select: { files: true } },
};
type ModuleRow = Prisma.ModuleGetPayload<{ include: typeof moduleInclude }>;

// Title key: trim spaces, lowercase ASCII A–Z only. Kept identical to the
// key the SQLite-era migration backfilled, so data imported from that period
// stays consistent. Consequence: non-ASCII case variants (e.g. "É" vs "é")
// count as different titles.
export const titleKey = (title: string) => title.replace(/^ +| +$/g, '').replace(/[A-Z]/g, (c) => c.toLowerCase());

const canManage = (user: User, mod: { origin: string; createdById: string | null }) =>
  mod.origin === 'AUTHORED' && (user.role === 'ADMIN' || (mod.createdById !== null && mod.createdById === user.id));

async function learnerCounts(moduleIds: string[]): Promise<Map<string, number>> {
  const rows = await prisma.lessonProgress.findMany({
    where: { lesson: { moduleId: { in: moduleIds } } },
    select: { userId: true, lesson: { select: { moduleId: true } } },
  });
  const sets = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!sets.has(r.lesson.moduleId)) sets.set(r.lesson.moduleId, new Set());
    sets.get(r.lesson.moduleId)!.add(r.userId);
  }
  return new Map([...sets].map(([id, s]) => [id, s.size]));
}

function summary(mod: ModuleRow, user: User, learners: number) {
  return {
    id: mod.id,
    name: mod.name,
    description: mod.description,
    category: mod.category,
    difficulty: mod.difficulty,
    duration: mod.duration,
    status: mod.status,
    isPredefined: mod.origin === 'BUILTIN',
    canManage: canManage(user, mod),
    createdBy: mod.createdBy,
    createdAt: mod.createdAt,
    updatedAt: mod.updatedAt,
    publishedAt: mod.publishedAt,
    deletedAt: mod.deletedAt,
    fileCount: mod._count.files,
    lessonCount: mod.lessons.length,
    learnerCount: learners,
    visibleToStudents: mod.status === STATUS.PUBLISHED,
  };
}

async function loadModule(db: Db, id: string): Promise<ModuleRow> {
  const mod = await db.module.findUnique({ where: { id }, include: moduleInclude });
  if (!mod) throw new HttpError(404, 'Module not found');
  return mod;
}

function assertManageable(user: User, mod: ModuleRow) {
  if (mod.origin === 'BUILTIN') throw new HttpError(403, 'Predefined modules are part of the built-in curriculum and cannot be changed here.');
  if (!canManage(user, mod)) throw new HttpError(403, 'You can only manage modules you created.');
  if (mod.status === STATUS.ARCHIVED) throw new HttpError(409, 'This module is archived and can no longer be changed.');
}

/**
 * Runs a module change as one transaction that starts with a guarded write
 * (touching updatedAt unless archived). That write row-locks the module until
 * the transaction ends, so competing changes to the same module run one at a
 * time; under READ COMMITTED a waiting transaction re-checks the guard against
 * the newly committed row and then reads that state. Any failure rolls back.
 */
function withModuleLock<T>(user: User, id: string, change: (db: Db, mod: ModuleRow) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (db) => {
    await db.module.updateMany({ where: { id, status: { not: STATUS.ARCHIVED }, origin: 'AUTHORED' }, data: { updatedAt: new Date() } });
    const mod = await loadModule(db, id);
    assertManageable(user, mod);
    return change(db, mod);
  }, { maxWait: 15_000, timeout: 30_000 });
}

function moduleData(input: ModuleInput) {
  return {
    name: input.title,
    activeTitleKey: titleKey(input.title),
    description: input.description,
    category: input.category,
    difficulty: DIFFICULTY_FROM_LABEL[input.difficulty],
    learningObjectives: input.learningObjectives,
    thumbnailUrl: input.thumbnailUrl || null,
    duration: input.estimatedTime ?? 30,
    tags: input.tags ?? [],
    referenceMaterials: input.referenceMaterials || null,
  };
}

// Requirements for students to see a module: every required field, plus
// learning material either typed in or extracted from an uploaded file.
async function publishProblems(db: Db, moduleId: string, learningObjectives: string | null, content: string, excludeFileId?: string) {
  const problems: string[] = [];
  if (!learningObjectives?.trim()) problems.push('Learning objectives are required.');
  if (!content.trim()) {
    const extracted = await db.moduleFile.count({
      where: { moduleId, processingStatus: 'EXTRACTED', ...(excludeFileId ? { id: { not: excludeFileId } } : {}) },
    });
    if (extracted === 0) problems.push('Add module content, or upload a file whose text could be extracted.');
  }
  return problems;
}

const contentOf = (mod: ModuleRow) => mod.lessons.find((l) => l.title === CONTENT_LESSON_TITLE && l.order === 1)?.content ?? '';

async function detail(id: string, user: User) {
  const mod = await loadModule(prisma, id);
  const files = await prisma.moduleFile.findMany({ where: { moduleId: id }, select: fileSelect, orderBy: { uploadedAt: 'asc' } });
  const learners = (await learnerCounts([id])).get(id) ?? 0;
  return {
    ...summary(mod, user, learners),
    learningObjectives: mod.learningObjectives,
    content: mod.origin === 'BUILTIN' ? null : contentOf(mod),
    thumbnailUrl: mod.thumbnailUrl,
    tags: (mod.tags as string[] | null) ?? [],
    referenceMaterials: mod.referenceMaterials,
    files,
  };
}

// GET /api/admin/modules — every module, built-in and authored, any status.
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const modules = await prisma.module.findMany({ include: moduleInclude, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
    const learners = await learnerCounts(modules.map((m) => m.id));
    res.json({ success: true, data: modules.map((m) => summary(m, req.user, learners.get(m.id) ?? 0)) });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/admin/modules/upload-config — how the client should upload.
router.get('/upload-config', (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { direct: usesObjectStorage(), maxFileMb: env.MODULE_FILE_MAX_MB, maxFiles: MAX_FILES_PER_UPLOAD } });
});

// GET /api/admin/modules/:id — full detail for edit and preview.
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await detail(String(req.params.id), req.user) });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/admin/modules — create as a draft, or publish immediately when
// `publish: true` and typed content is included (files can only be added
// once the module exists). One insert: the title key makes duplicates fail.
router.post('/', validate(createModuleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const input = createModuleSchema.shape.body.parse(req.body);
    const publishNow = !!input.publish && !!input.content.trim();
    const maxOrder = await prisma.module.aggregate({ _max: { order: true } });

    const created = await prisma.module.create({
      data: {
        ...moduleData(input),
        origin: 'AUTHORED',
        type: 'custom',
        content: {},
        order: Math.max(maxOrder._max.order ?? 0, 999) + 1, // after the built-in curriculum
        status: publishNow ? STATUS.PUBLISHED : STATUS.DRAFT,
        publishedAt: publishNow ? new Date() : null,
        createdById: req.user.id,
        lessons: { create: { title: CONTENT_LESSON_TITLE, type: 'theory', order: 1, content: input.content } },
      },
    });

    const warnings = input.publish && !publishNow
      ? ['Saved as a draft — it can\'t be published yet.', 'Add module content, or upload a file whose text could be extracted.']
      : undefined;
    res.status(201).json({ success: true, data: await detail(created.id, req.user), ...(warnings ? { warnings } : {}) });
  } catch (err) {
    handleError(res, err);
  }
});

// PUT /api/admin/modules/:id — edit details/content. A published module
// stays published (students see the update at once) but must still meet
// the publishing requirements.
router.put('/:id', validate(updateModuleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const input = updateModuleSchema.shape.body.parse(req.body);
    await withModuleLock(req.user, String(req.params.id), async (db, mod) => {
      if (mod.status === STATUS.PUBLISHED) {
        const problems = await publishProblems(db, mod.id, input.learningObjectives, input.content);
        if (problems.length) throw new HttpError(400, 'A published module must keep its learning material. Unpublish it first to clear the content.', problems);
      }
      await db.module.update({ where: { id: mod.id }, data: moduleData(input) });
      const lesson = mod.lessons.find((l) => l.title === CONTENT_LESSON_TITLE && l.order === 1);
      if (lesson) await db.lesson.update({ where: { id: lesson.id }, data: { content: input.content } });
      else await db.lesson.create({ data: { moduleId: mod.id, title: CONTENT_LESSON_TITLE, type: 'theory', order: 1, content: input.content } });
    });
    res.json({ success: true, data: await detail(String(req.params.id), req.user) });
  } catch (err) {
    handleError(res, err);
  }
});

// PATCH /api/admin/modules/:id/publish
router.patch('/:id/publish', async (req: AuthRequest, res: Response) => {
  try {
    await withModuleLock(req.user, String(req.params.id), async (db, mod) => {
      const problems = await publishProblems(db, mod.id, mod.learningObjectives, contentOf(mod));
      if (problems.length) throw new HttpError(400, 'This module isn\'t ready to publish.', problems);
      await db.module.update({ where: { id: mod.id }, data: { status: STATUS.PUBLISHED, publishedAt: new Date() } });
    });
    res.json({ success: true, data: await detail(String(req.params.id), req.user) });
  } catch (err) {
    handleError(res, err);
  }
});

// PATCH /api/admin/modules/:id/unpublish — back to draft; hidden from students.
router.patch('/:id/unpublish', async (req: AuthRequest, res: Response) => {
  try {
    await withModuleLock(req.user, String(req.params.id), async (db, mod) => {
      if (mod.status !== STATUS.PUBLISHED) throw new HttpError(409, 'Only a published module can be unpublished.');
      await db.module.update({ where: { id: mod.id }, data: { status: STATUS.DRAFT } });
    });
    res.json({ success: true, data: await detail(String(req.params.id), req.user) });
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /api/admin/modules/:id — archive (soft delete). The caller must
// send the module's exact name. Lessons, learners' progress, files and any
// history are kept; students no longer see it; its title becomes reusable.
router.delete('/:id', validate(archiveModuleSchema), async (req: AuthRequest, res: Response) => {
  try {
    await withModuleLock(req.user, String(req.params.id), async (db, mod) => {
      if (String(req.body.confirmName).trim() !== mod.name.trim()) {
        throw new HttpError(400, 'The confirmation name does not match this module\'s name.');
      }
      await db.module.update({ where: { id: mod.id }, data: { status: STATUS.ARCHIVED, deletedAt: new Date(), activeTitleKey: null } });
    });
    res.json({ success: true, data: await detail(String(req.params.id), req.user) });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Files ────────────────────────────────────────────────────────────────────

const MB = 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MODULE_FILE_MAX_MB * MB, files: MAX_FILES_PER_UPLOAD, fields: 0 },
});

// Cheap gates before any file bytes are read: the caller may manage this
// module, and the declared request size fits the whole-upload budget (so
// in-memory buffering is bounded by MODULE_UPLOAD_MAX_TOTAL_MB, not by
// files × per-file limit).
async function checkBeforeReceiving(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertManageable(req.user, await loadModule(prisma, String(req.params.id)));
    const declared = Number(req.headers['content-length']);
    if (!req.headers['content-length'] || !Number.isFinite(declared)) {
      throw new HttpError(411, 'Upload size is required (Content-Length).');
    }
    if (declared > env.MODULE_UPLOAD_MAX_TOTAL_MB * MB) {
      throw new HttpError(413, `Uploads are limited to ${env.MODULE_UPLOAD_MAX_TOTAL_MB} MB per request. Upload fewer or smaller files at a time.`);
    }
    next();
  } catch (err) {
    handleError(res, err);
  }
}

function receiveFiles(req: AuthRequest, res: Response, next: NextFunction) {
  upload.array('files', MAX_FILES_PER_UPLOAD)(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? `Each file must be ${env.MODULE_FILE_MAX_MB} MB or smaller.`
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `Upload at most ${MAX_FILES_PER_UPLOAD} files at a time, in the "files" field.`
        : 'The upload could not be read.';
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, error: message });
    }
    handleError(res, err);
  });
}

// One incoming file, wherever its bytes come from (multipart body or a
// direct-to-storage staged upload).
interface IncomingFile {
  name: string;
  mime: string;
  read(): Promise<Buffer>;
  store(fileType: ModuleFileType, buf: Buffer): Promise<string>;
  discard?(): Promise<void>;
}

// Shared by both upload paths. Each file is validated and processed
// independently (extraction runs in a killable child process); valid
// originals are stored, then all rows are inserted in one locked
// transaction. If the module was archived meanwhile, or anything fails, the
// stored files are removed and nothing is recorded.
async function acceptFiles(user: User, moduleId: string, files: IncomingFile[]) {
  const stored: string[] = [];
  const ready: Prisma.ModuleFileCreateManyInput[] = [];
  const rejected: { originalFileName: string; error: string }[] = [];
  try {
    for (const f of files) {
      try {
        const buf = await f.read();
        const validated = validateUpload(f.name, f.mime, buf);
        const extraction = await extractText(validated.fileType, buf);
        const storedFileName = await f.store(validated.fileType, buf);
        stored.push(storedFileName);
        ready.push({ moduleId, storedFileName, fileSize: buf.length, uploadedById: user.id, ...validated, ...extraction });
      } catch (err) {
        if (!(err instanceof FileRejection)) throw err;
        rejected.push({ originalFileName: f.name.slice(0, 120), error: err.message });
        await f.discard?.();
      }
    }
    let accepted: unknown[] = [];
    if (ready.length) {
      accepted = await withModuleLock(user, moduleId, async (db) => {
        await db.moduleFile.createMany({ data: ready });
        const rows = await db.moduleFile.findMany({ where: { storedFileName: { in: ready.map((r) => r.storedFileName) } }, select: { ...fileSelect, storedFileName: true } });
        // Same order as uploaded; storedFileName is only used for matching here.
        return ready.map((r) => {
          const { storedFileName: _internal, ...row } = rows.find((x) => x.storedFileName === r.storedFileName)!;
          return row;
        });
      });
    }
    return { accepted, rejected };
  } catch (err) {
    await Promise.all(stored.map((name) => removeStoredFile(name).catch(() => {})));
    await Promise.all(files.map((f) => f.discard?.()));
    throw err;
  }
}

function sendUploadResult(res: Response, result: { accepted: unknown[]; rejected: unknown[] }) {
  const ok = result.accepted.length > 0;
  res.status(ok ? 201 : 422).json({ success: ok, ...(ok ? {} : { error: 'None of the files could be accepted.' }), data: result });
}

// POST /api/admin/modules/:id/upload — multipart field "files" (1–10).
router.post('/:id/upload', checkBeforeReceiving, receiveFiles, async (req: AuthRequest, res: Response) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw new HttpError(400, 'Choose at least one file to upload.');
    sendUploadResult(res, await acceptFiles(req.user, String(req.params.id), files.map((f) => ({
      // multer decodes multipart filenames as latin1; recover UTF-8 names.
      name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      mime: f.mimetype,
      read: async () => f.buffer,
      store: storeFile,
    }))));
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/admin/modules/:id/upload-urls — object storage only. Pre-checks
// each declared file and returns a signed URL the browser PUTs it to.
router.post('/:id/upload-urls', validate(uploadUrlsSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!usesObjectStorage()) throw new HttpError(404, 'Direct uploads are not enabled on this server.');
    assertManageable(req.user, await loadModule(prisma, String(req.params.id)));
    // `index` ties each target to the request's file list (names are sanitized).
    const targets: (UploadTarget & { index: number })[] = [];
    const rejected: { originalFileName: string; error: string }[] = [];
    for (const [index, f] of (req.body.files as { name: string; type: string; size: number }[]).entries()) {
      try {
        targets.push({ ...(await createUploadTarget(f.name, f.type, f.size)), index });
      } catch (err) {
        if (!(err instanceof FileRejection)) throw err;
        rejected.push({ originalFileName: f.name.slice(0, 120), error: err.message });
      }
    }
    res.json({ success: true, data: { targets, rejected } });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/admin/modules/:id/upload-complete — process files the browser
// uploaded to their signed URLs. Same validation, extraction and locking as
// a multipart upload; staged objects are moved or discarded either way.
router.post('/:id/upload-complete', validate(uploadCompleteSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!usesObjectStorage()) throw new HttpError(404, 'Direct uploads are not enabled on this server.');
    assertManageable(req.user, await loadModule(prisma, String(req.params.id)));
    const uploads = req.body.uploads as { uploadId: string; name: string; type: string }[];
    sendUploadResult(res, await acceptFiles(req.user, String(req.params.id), uploads.map((u) => ({
      name: u.name,
      mime: u.type,
      read: () => readStagedUpload(u.uploadId),
      store: (fileType) => promoteStagedUpload(u.uploadId, fileType),
      discard: () => discardStagedUpload(u.uploadId),
    }))));
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /api/admin/modules/:id/files/:fileId
router.delete('/:id/files/:fileId', async (req: AuthRequest, res: Response) => {
  try {
    const removed = await withModuleLock(req.user, String(req.params.id), async (db, mod) => {
      const file = await db.moduleFile.findFirst({ where: { id: String(req.params.fileId), moduleId: mod.id } });
      if (!file) throw new HttpError(404, 'File not found');
      if (mod.status === STATUS.PUBLISHED && (await publishProblems(db, mod.id, mod.learningObjectives, contentOf(mod), file.id)).length) {
        throw new HttpError(400, 'This is the module\'s only learning material. Add content or another file first, or unpublish the module.');
      }
      await db.moduleFile.delete({ where: { id: file.id } });
      return file;
    });
    await removeStoredFile(removed.storedFileName); // after commit: a rollback never loses the original
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/admin/modules/:id/files/:fileId/download — original file, any status.
router.get('/:id/files/:fileId/download', async (req: AuthRequest, res: Response) => {
  try {
    const file = await prisma.moduleFile.findFirst({ where: { id: String(req.params.fileId), moduleId: String(req.params.id) } });
    if (!file) throw new HttpError(404, 'File not found');
    if (usesObjectStorage()) return res.redirect(302, await signedDownloadUrl(file.storedFileName, file.originalFileName));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', attachmentHeader(file.originalFileName));
    openStoredFile(file.storedFileName)
      .on('error', () => { if (!res.headersSent) res.status(404).json({ success: false, error: 'File not found' }); else res.destroy(); })
      .pipe(res);
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
