import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { pdfWith, docxWith, pptxWith, MIME } from '../fixtures/moduleDocuments';
import { testDatabase } from '../fixtures/testDatabase';

// Real fork everywhere, except when spawnFailure.on is set: then the worker is
// launched with a nonexistent Node executable, so the process never starts
// (Node emits 'error' and 'close' but no 'exit' and no pid).
const spawnFailure = vi.hoisted(() => ({ on: false }));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    fork: ((file: string, args: string[], opts: any) =>
      actual.fork(file, args, spawnFailure.on ? { ...opts, execPath: '/nonexistent/cyberlearn-node' } : opts)) as typeof actual.fork,
  };
});

// Teacher/Admin Module Management end to end through the real routers and
// auth, on a fresh PostgreSQL schema (all migrations) and a temporary private
// storage directory. Requests are injected in-process (no port).
const fixtureDir = mkdtempSync(join(tmpdir(), 'cyberlearn-modules-test-'));
const storageDir = join(fixtureDir, 'module-files');
const testDb = testDatabase('modules');
const databaseUrl = testDb.url;
const db = new PrismaClient({ datasourceUrl: databaseUrl });

let app: express.Express;
let secret: string;
let envRef: typeof import('../../src/config/env').env;
const ids: Record<string, string> = {};
let predefinedId: string;
let predefinedLessonId: string;

beforeAll(async () => {
  execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    env: testDb.cliEnv,
    stdio: 'pipe',
  });
  vi.stubEnv('DATABASE_URL', databaseUrl);
  vi.stubEnv('MODULE_FILE_DIR', storageDir);
  vi.stubEnv('MODULE_FILE_MAX_MB', '1');
  const [{ default: adminModules }, { default: admin }, { default: modules }, envModule] = await Promise.all([
    import('../../src/routes/adminModules.routes'),
    import('../../src/routes/admin.routes'),
    import('../../src/routes/modules.routes'),
    import('../../src/config/env'),
  ]);
  secret = envModule.env.JWT_SECRET;
  envRef = envModule.env;
  app = express();
  app.use(express.json());
  app.use('/api/admin/modules', adminModules);
  app.use('/api/admin', admin);
  app.use('/api/modules', modules);

  for (const [name, role] of [['admin', 'ADMIN'], ['teacher', 'TEACHER'], ['teacher2', 'TEACHER'], ['student', 'USER']] as const) {
    ids[name] = (await db.user.create({ data: { email: `${name}@example.invalid`, name: `Test ${name}`, password: 'x', role } })).id;
  }
  // A predefined (seeded) module with a learner's progress on it.
  const pre = await db.module.create({
    data: {
      name: 'Web Safety Basics', activeTitleKey: 'web safety basics', description: 'Seeded', category: 'Web Security', difficulty: 'Easy', duration: 20, type: 'lesson', content: {}, order: 11,
      lessons: { create: { title: 'Intro', content: 'Seeded theory', type: 'theory', order: 1 } },
    },
    include: { lessons: true },
  });
  predefinedId = pre.id;
  predefinedLessonId = pre.lessons[0].id;
  await db.lessonProgress.create({ data: { userId: ids.student, lessonId: predefinedLessonId } });
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
  await testDb.drop();
  vi.unstubAllEnvs();
  rmSync(fixtureDir, { recursive: true, force: true });
});

type Upload = { name: string; type: string; data: Buffer };

function call(method: string, path: string, as: string | null, opts: { json?: unknown; files?: Upload[]; noLength?: boolean } = {}): Promise<{ status: number; body: any; raw: Buffer; headers: Record<string, any> }> {
  return new Promise((resolvePromise, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = method;
    req.url = path;
    const headers: Record<string, string> = as ? { authorization: `Bearer ${jwt.sign({ id: ids[as] }, secret)}` } : {};
    let payload: Buffer | null = null;
    if (opts.json !== undefined) {
      payload = Buffer.from(JSON.stringify(opts.json));
      headers['content-type'] = 'application/json';
    } else if (opts.files) {
      const boundary = '----cyberlearntest' + Math.random().toString(16).slice(2);
      const parts: Buffer[] = [];
      for (const f of opts.files) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n`), f.data, Buffer.from('\r\n'));
      }
      parts.push(Buffer.from(`--${boundary}--\r\n`));
      payload = Buffer.concat(parts);
      headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
    }
    if (payload && !opts.noLength) headers['content-length'] = String(payload.length);
    req.headers = headers;
    // A real HTTP parser marks the message complete; without it Node treats
    // the injected request as aborted when it ends (multer then rejects it).
    req.complete = true;
    if (payload) req.push(payload);
    req.push(null);
    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    res.write = ((chunk: any, ...rest: any[]) => { chunks.push(Buffer.from(chunk)); return true; }) as any;
    res.end = ((chunk?: any) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      let body: any = null;
      try { body = JSON.parse(raw.toString('utf8')); } catch { /* binary download */ }
      resolvePromise({ status: res.statusCode, body, raw, headers: res.getHeaders() });
      return res;
    }) as any;
    void origWrite;
    (app as any)(req, res, reject);
  });
}

const baseModule = {
  title: 'Phishing Defense Workshop',
  description: 'Recognise and report phishing.',
  category: 'Social Engineering',
  difficulty: 'Beginner',
  learningObjectives: '- Spot red flags\n- Report suspicious mail',
  estimatedTime: 25,
  tags: ['phishing', 'email'],
};

const leaksStorage = (body: unknown) => {
  const s = JSON.stringify(body);
  return s.includes('storedFileName') || s.includes(storageDir) || /[0-9a-f-]{36}\.(pdf|docx|pptx|txt)/.test(s);
};

describe('authorization', () => {
  it('students cannot reach module management; teachers can, but not other admin routes', async () => {
    expect((await call('GET', '/api/admin/modules', 'student')).status).toBe(403);
    expect((await call('POST', '/api/admin/modules', 'student', { json: baseModule })).status).toBe(403);
    expect((await call('GET', '/api/admin/modules', null)).status).toBe(401);
    expect((await call('GET', '/api/admin/modules', 'teacher')).status).toBe(200);
    expect((await call('GET', '/api/admin/modules', 'admin')).status).toBe(200);
    expect((await call('GET', '/api/admin/users', 'teacher')).status).toBe(403);
  });
});

describe('create, validate, duplicates', () => {
  it('rejects empty or invalid required fields', async () => {
    for (const bad of [
      { ...baseModule, title: '   ' },
      { ...baseModule, description: '' },
      { ...baseModule, learningObjectives: '' },
      { ...baseModule, category: '' },
      { ...baseModule, difficulty: 'Expert' },
      { ...baseModule, thumbnailUrl: 'javascript:alert(1)' },
    ]) {
      const r = await call('POST', '/api/admin/modules', 'teacher', { json: bad });
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('creates a draft that students cannot see or open', async () => {
    const r = await call('POST', '/api/admin/modules', 'teacher', { json: baseModule });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ name: baseModule.title, status: 'DRAFT', difficulty: 'Easy', canManage: true, isPredefined: false, createdBy: { id: ids.teacher } });
    ids.module = r.body.data.id;

    const list = await call('GET', '/api/modules', 'student');
    expect(list.body.data.map((m: any) => m.id)).not.toContain(ids.module);
    expect((await call('GET', `/api/modules/${ids.module}`, 'student')).status).toBe(404);
  });

  it('rejects duplicate names case-insensitively, including predefined modules', async () => {
    expect((await call('POST', '/api/admin/modules', 'teacher2', { json: { ...baseModule, title: 'phishing defense WORKSHOP' } })).status).toBe(409);
    expect((await call('POST', '/api/admin/modules', 'teacher2', { json: { ...baseModule, title: 'Web Safety Basics' } })).status).toBe(409);
  });

  it('cannot publish without learning material', async () => {
    const r = await call('PATCH', `/api/admin/modules/${ids.module}/publish`, 'teacher');
    expect(r.status).toBe(400);
    expect(r.body.details.join(' ')).toMatch(/content|upload/i);
  });
});

describe('uploads', () => {
  it('accepts multiple valid files, extracts text and never exposes storage paths', async () => {
    const files: Upload[] = [
      { name: 'Lecture.pdf', type: MIME.pdf, data: await pdfWith('Phishing emails create urgency.') },
      { name: 'Handout.docx', type: MIME.docx, data: await docxWith(['Check the sender domain.']) },
      { name: 'Slides.pptx', type: MIME.pptx, data: await pptxWith([['Report it', 'Use the report button']]) },
      { name: 'Notes.txt', type: MIME.txt, data: Buffer.from('Never share passwords by email.') },
    ];
    const r = await call('POST', `/api/admin/modules/${ids.module}/upload`, 'teacher', { files });
    expect(r.status).toBe(201);
    expect(r.body.data.rejected).toEqual([]);
    const accepted = r.body.data.accepted;
    expect(accepted.map((f: any) => [f.originalFileName, f.fileType, f.processingStatus])).toEqual([
      ['Lecture.pdf', 'pdf', 'EXTRACTED'], ['Handout.docx', 'docx', 'EXTRACTED'], ['Slides.pptx', 'pptx', 'EXTRACTED'], ['Notes.txt', 'txt', 'EXTRACTED'],
    ]);
    expect(accepted[0].extractedText).toContain('Phishing emails create urgency.');
    expect(accepted[1].extractedText).toContain('Check the sender domain.');
    expect(accepted[2].extractedText).toContain('Use the report button');
    expect(leaksStorage(r.body)).toBe(false);
    expect(readdirSync(storageDir)).toHaveLength(4);
    ids.pdfFile = accepted[0].id;
    ids.pdfBytes = files[0].data.toString('base64');
  });

  it('rejects unsupported, mislabelled and corrupt files with a reason, and keeps text-less files', async () => {
    const r = await call('POST', `/api/admin/modules/${ids.module}/upload`, 'teacher', {
      files: [
        { name: 'tool.exe', type: 'application/octet-stream', data: Buffer.from('MZ binary') },
        { name: 'broken.pdf', type: MIME.pdf, data: Buffer.from('%PDF-1.7\nthis is not a real pdf') },
        { name: 'renamed.docx', type: MIME.docx, data: Buffer.from('plain text pretending') },
        { name: 'notes.txt', type: MIME.pdf, data: Buffer.from('type mismatch') },
        { name: '../../etc/scan.pdf', type: MIME.pdf, data: await pdfWith('') },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.body.data.rejected.map((x: any) => x.originalFileName)).toEqual(['tool.exe', 'broken.pdf', 'renamed.docx', 'notes.txt']);
    for (const x of r.body.data.rejected) expect(x.error).toBeTruthy();
    expect(r.body.data.accepted).toHaveLength(1);
    expect(r.body.data.accepted[0]).toMatchObject({ originalFileName: 'scan.pdf', processingStatus: 'NO_TEXT' });
    expect(r.body.data.accepted[0].processingNote).toMatch(/manually/);
    expect(readdirSync(storageDir)).toHaveLength(5); // rejected files were never stored
  });

  it('answers 422 when every file is rejected, 400 for no files, 413 when oversized', async () => {
    expect((await call('POST', `/api/admin/modules/${ids.module}/upload`, 'teacher', { files: [{ name: 'a.exe', type: 'application/x-msdownload', data: Buffer.from('x') }] })).status).toBe(422);
    expect((await call('POST', `/api/admin/modules/${ids.module}/upload`, 'teacher', { files: [] })).status).toBe(400);
    const big = await call('POST', `/api/admin/modules/${ids.module}/upload`, 'teacher', { files: [{ name: 'big.txt', type: MIME.txt, data: Buffer.alloc(1.5 * 1024 * 1024, 'a') }] });
    expect(big.status).toBe(413);
    expect(readdirSync(storageDir)).toHaveLength(5);
  });

  it('only the author or an admin can upload or edit; predefined modules are read-only', async () => {
    expect((await call('POST', `/api/admin/modules/${ids.module}/upload`, 'teacher2', { files: [{ name: 'n.txt', type: MIME.txt, data: Buffer.from('x') }] })).status).toBe(403);
    expect((await call('PUT', `/api/admin/modules/${ids.module}`, 'teacher2', { json: baseModule })).status).toBe(403);
    expect((await call('PUT', `/api/admin/modules/${predefinedId}`, 'admin', { json: { ...baseModule, title: 'Renamed' } })).status).toBe(403);
    expect((await call('GET', `/api/admin/modules/${ids.module}`, 'teacher2')).status).toBe(200); // any manager may view
  });
});

describe('publish, student view, edit, unpublish', () => {
  it('publishes once material exists; students see it, open it and download originals', async () => {
    const pub = await call('PATCH', `/api/admin/modules/${ids.module}/publish`, 'teacher');
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('PUBLISHED');

    const list = await call('GET', '/api/modules', 'student');
    const listed = list.body.data.find((m: any) => m.id === ids.module);
    expect(listed).toMatchObject({ name: baseModule.title, category: 'Social Engineering', difficulty: 'Easy', isCustom: true, fileCount: 5 });
    expect(list.body.data.map((m: any) => m.id)).toContain(predefinedId); // predefined still there

    const detail = await call('GET', `/api/modules/${ids.module}`, 'student');
    expect(detail.status).toBe(200);
    expect(detail.body.data.files).toHaveLength(5);
    expect(detail.body.data.files[0].extractedText).toContain('Phishing emails create urgency.');
    expect(detail.body.data.learningObjectives).toContain('Spot red flags');
    expect(leaksStorage(detail.body)).toBe(false);

    const dl = await call('GET', `/api/modules/${ids.module}/files/${ids.pdfFile}/download`, 'student');
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toBe('application/pdf');
    expect(String(dl.headers['content-disposition'])).toContain('Lecture.pdf');
    expect(dl.raw.equals(Buffer.from(ids.pdfBytes, 'base64'))).toBe(true);
  });

  it('student lesson completion works on the published module', async () => {
    const lessonId = (await db.lesson.findFirstOrThrow({ where: { moduleId: ids.module } })).id;
    ids.lesson = lessonId;
    expect((await call('POST', `/api/modules/${ids.module}/lessons/${lessonId}/complete`, 'student')).status).toBe(200);
  });

  it('edits to a published module are visible to students at once', async () => {
    const r = await call('PUT', `/api/admin/modules/${ids.module}`, 'admin', {
      json: { ...baseModule, title: 'Phishing Defense Workshop v2', content: 'Updated guidance for learners.', difficulty: 'Advanced' },
    });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'PUBLISHED', name: 'Phishing Defense Workshop v2', difficulty: 'Hard', content: 'Updated guidance for learners.' });
    const detail = await call('GET', `/api/modules/${ids.module}`, 'student');
    expect(detail.body.data.name).toBe('Phishing Defense Workshop v2');
    expect(detail.body.data.lessons[0]).toMatchObject({ content: 'Updated guidance for learners.', completed: true }); // progress kept across edits
  });

  it('unpublishing hides the module and its files from students; republishing restores it', async () => {
    expect((await call('PATCH', `/api/admin/modules/${ids.module}/unpublish`, 'teacher')).body.data.status).toBe('DRAFT');
    expect((await call('GET', '/api/modules', 'student')).body.data.map((m: any) => m.id)).not.toContain(ids.module);
    expect((await call('GET', `/api/modules/${ids.module}`, 'student')).status).toBe(404);
    expect((await call('GET', `/api/modules/${ids.module}/files/${ids.pdfFile}/download`, 'student')).status).toBe(404);
    expect((await call('POST', `/api/modules/${ids.module}/lessons/${ids.lesson}/complete`, 'student')).status).toBe(404);
    // authors can still download while unpublished
    expect((await call('GET', `/api/admin/modules/${ids.module}/files/${ids.pdfFile}/download`, 'teacher')).status).toBe(200);

    expect((await call('PATCH', `/api/admin/modules/${ids.module}/publish`, 'teacher')).body.data.status).toBe('PUBLISHED');
    expect((await call('GET', `/api/modules/${ids.module}`, 'student')).status).toBe(200);
  });
});

describe('archive (delete)', () => {
  it('requires the exact module name, then hides it while keeping progress, files and history', async () => {
    const wrong = await call('DELETE', `/api/admin/modules/${ids.module}`, 'teacher', { json: { confirmName: 'Phishing Defense Workshop' } });
    expect(wrong.status).toBe(400);

    const r = await call('DELETE', `/api/admin/modules/${ids.module}`, 'teacher', { json: { confirmName: 'Phishing Defense Workshop v2' } });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('ARCHIVED');
    expect(r.body.data.deletedAt).toBeTruthy();

    expect((await call('GET', '/api/modules', 'student')).body.data.map((m: any) => m.id)).not.toContain(ids.module);
    expect((await call('GET', `/api/modules/${ids.module}`, 'student')).status).toBe(404);
    // nothing destroyed
    expect(await db.module.count({ where: { id: ids.module } })).toBe(1);
    expect(await db.lessonProgress.count({ where: { lessonId: ids.lesson, userId: ids.student } })).toBe(1);
    expect(await db.moduleFile.count({ where: { moduleId: ids.module } })).toBe(5);
    expect(existsSync(storageDir) && readdirSync(storageDir).length).toBe(5);
    // archived modules can't be changed or republished
    expect((await call('PATCH', `/api/admin/modules/${ids.module}/publish`, 'teacher')).status).toBe(409);
    // still listed for managers, and its title can be reused
    const adminList = await call('GET', '/api/admin/modules', 'admin');
    expect(adminList.body.data.find((m: any) => m.id === ids.module)).toMatchObject({ status: 'ARCHIVED', learnerCount: 1, fileCount: 5 });
    expect((await call('POST', '/api/admin/modules', 'teacher2', { json: { ...baseModule, title: 'Phishing Defense Workshop v2' } })).status).toBe(201);
  });

  it('predefined modules and their learner progress are untouched', async () => {
    const detail = await call('GET', `/api/modules/${predefinedId}`, 'student');
    expect(detail.status).toBe(200);
    expect(detail.body.data.lessons[0].completed).toBe(true);
    expect(detail.body.data.isCustom).toBe(false);
  });

  it('publish with the create call goes live at once when material is included', async () => {
    const r = await call('POST', '/api/admin/modules', 'teacher', { json: { ...baseModule, title: 'Instant Publish', content: 'Typed content.', publish: true } });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('PUBLISHED');
    expect((await call('GET', `/api/modules/${r.body.data.id}`, 'student')).status).toBe(200);
  });
});

// ─── CLIENT-002 corrections ─────────────────────────────────────────────────

// Number of stored originals (the folder only exists after the first upload).
const storedCount = () => (existsSync(storageDir) ? readdirSync(storageDir).length : 0);

let seq = 0;
async function draftWithContent(as = 'teacher') {
  const r = await call('POST', '/api/admin/modules', as, { json: { ...baseModule, title: `Race Module ${++seq}`, content: 'Typed material.' } });
  expect(r.status).toBe(201);
  return r.body.data.id as string;
}

describe('concurrent lifecycle changes', () => {
  it('simultaneous creates with the same title: exactly one wins (database-enforced)', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) =>
      call('POST', '/api/admin/modules', i % 2 ? 'teacher' : 'admin', { json: { ...baseModule, title: i % 2 ? 'Same Title' : 'same title ' } })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await db.module.count({ where: { activeTitleKey: 'same title' } })).toBe(1);
  });

  it('simultaneous renames to the same title: exactly one wins', async () => {
    const [a, b] = [await draftWithContent(), await draftWithContent()];
    const results = await Promise.all([a, b].map((id) => call('PUT', `/api/admin/modules/${id}`, 'teacher', { json: { ...baseModule, title: 'Renamed Together', content: 'x' } })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db.module.count({ where: { activeTitleKey: 'renamed together' } })).toBe(1);
  });

  it('publish racing archive never leaves an archived module published', async () => {
    for (let i = 0; i < 5; i++) {
      const id = await draftWithContent();
      const name = (await db.module.findUniqueOrThrow({ where: { id } })).name;
      const [pub, arch] = await Promise.all([
        call('PATCH', `/api/admin/modules/${id}/publish`, 'teacher'),
        call('DELETE', `/api/admin/modules/${id}`, 'teacher', { json: { confirmName: name } }),
      ]);
      expect(arch.status).toBe(200);
      expect([200, 409]).toContain(pub.status);
      const after = await db.module.findUniqueOrThrow({ where: { id } });
      expect(after).toMatchObject({ status: 'ARCHIVED', activeTitleKey: null });
      expect((await call('GET', `/api/modules/${id}`, 'student')).status).toBe(404);
    }
  });

  it('an upload that finishes after an archive is discarded: no rows, no stored files', async () => {
    const id = await draftWithContent();
    const name = (await db.module.findUniqueOrThrow({ where: { id } })).name;
    const filesBefore = storedCount();
    // Extraction runs in a child process (~hundreds of ms), so the archive commits first.
    const uploading = call('POST', `/api/admin/modules/${id}/upload`, 'teacher', { files: [{ name: 'late.pdf', type: MIME.pdf, data: await pdfWith('Late upload') }] });
    await new Promise((r) => setTimeout(r, 30));
    expect((await call('DELETE', `/api/admin/modules/${id}`, 'teacher', { json: { confirmName: name } })).status).toBe(200);
    const up = await uploading;
    expect(up.status).toBe(409);
    expect(await db.moduleFile.count({ where: { moduleId: id } })).toBe(0);
    expect(storedCount()).toBe(filesBefore);
  });

  it('removing the last file racing a content clear never leaves a published module without material', async () => {
    for (let i = 0; i < 5; i++) {
      const id = await draftWithContent();
      const up = await call('POST', `/api/admin/modules/${id}/upload`, 'teacher', { files: [{ name: 'only.txt', type: MIME.txt, data: Buffer.from('Only file text.') }] });
      const fileId = up.body.data.accepted[0].id;
      expect((await call('PATCH', `/api/admin/modules/${id}/publish`, 'teacher')).status).toBe(200);
      const name = (await db.module.findUniqueOrThrow({ where: { id } })).name;

      const [removal, clearing] = await Promise.all([
        call('DELETE', `/api/admin/modules/${id}/files/${fileId}`, 'teacher'),
        call('PUT', `/api/admin/modules/${id}`, 'teacher', { json: { ...baseModule, title: name, content: '' } }),
      ]);
      expect([removal.status, clearing.status].filter((s) => s === 200)).toHaveLength(1); // exactly one may win
      const mod = await db.module.findUniqueOrThrow({ where: { id }, include: { lessons: true } });
      const extracted = await db.moduleFile.count({ where: { moduleId: id, processingStatus: 'EXTRACTED' } });
      expect(mod.status).toBe('PUBLISHED');
      expect(mod.lessons[0].content.trim().length > 0 || extracted > 0).toBe(true);
    }
  });
});

describe('bounded upload processing', () => {
  it('rejects a request over the total upload budget before reading it — nothing stored', async () => {
    const id = await draftWithContent();
    const before = storedCount();
    const original = envRef.MODULE_UPLOAD_MAX_TOTAL_MB;
    envRef.MODULE_UPLOAD_MAX_TOTAL_MB = 1.2; // each file is under the 1 MB per-file limit, together they're not
    try {
      const r = await call('POST', `/api/admin/modules/${id}/upload`, 'teacher', {
        files: [0, 1].map((n) => ({ name: `part${n}.txt`, type: MIME.txt, data: Buffer.alloc(0.8 * 1024 * 1024, 'a') })),
      });
      expect(r.status).toBe(413);
      expect(r.body.error).toMatch(/1\.2 MB per request/);
    } finally {
      envRef.MODULE_UPLOAD_MAX_TOTAL_MB = original;
    }
    expect(storedCount()).toBe(before);
    expect(await db.moduleFile.count({ where: { moduleId: id } })).toBe(0);
  });

  it('requires a declared upload size', async () => {
    const id = await draftWithContent();
    const r = await call('POST', `/api/admin/modules/${id}/upload`, 'teacher', { files: [{ name: 'a.txt', type: MIME.txt, data: Buffer.from('x') }], noLength: true });
    expect(r.status).toBe(411);
  });

  it('stops extraction at the deadline, keeps the original for manual entry, and leaves no worker running', async () => {
    const id = await draftWithContent();
    const original = envRef.MODULE_EXTRACT_TIMEOUT_MS;
    envRef.MODULE_EXTRACT_TIMEOUT_MS = 1; // the worker can't even start in 1 ms
    let r;
    try {
      r = await call('POST', `/api/admin/modules/${id}/upload`, 'teacher', { files: [{ name: 'slow.pdf', type: MIME.pdf, data: await pdfWith('Never extracted') }] });
    } finally {
      envRef.MODULE_EXTRACT_TIMEOUT_MS = original;
    }
    expect(r.status).toBe(201);
    expect(r.body.data.accepted[0]).toMatchObject({ originalFileName: 'slow.pdf', processingStatus: 'NO_TEXT', extractedText: null });
    expect(r.body.data.accepted[0].processingNote).toMatch(/took too long and was stopped.*enter the module content manually/);
    const dl = await call('GET', `/api/admin/modules/${id}/files/${r.body.data.accepted[0].id}/download`, 'teacher');
    expect(dl.status).toBe(200);
    expect(dl.raw.subarray(0, 5).toString()).toBe('%PDF-');
    // Deterministic, no process listing: the upload only completes after the
    // worker's own exit event fired; the record shows it was the timed-out
    // worker and that it died by SIGKILL; the OS confirms the pid is gone.
    const { workerStats } = await import('../../src/services/moduleFiles');
    const stats = workerStats();
    expect(stats.live).toBe(0);
    expect(stats.last).toMatchObject({ timedOut: true, signal: 'SIGKILL' });
    expect(stats.last!.pid).toBeGreaterThan(0);
    expect(() => process.kill(stats.last!.pid!, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
  });
});

describe('worker that never starts', () => {
  it('settles the upload as extraction-unavailable, keeps the original and leaves no tracked worker', async () => {
    const id = await draftWithContent();
    const data = Buffer.from('Notes that could not be processed.');
    spawnFailure.on = true;
    let r;
    try {
      r = await call('POST', `/api/admin/modules/${id}/upload`, 'teacher', { files: [{ name: 'notes.txt', type: MIME.txt, data }] });
    } finally {
      spawnFailure.on = false;
    }
    expect(r.status).toBe(201);
    expect(r.body.data.accepted[0]).toMatchObject({ originalFileName: 'notes.txt', processingStatus: 'NO_TEXT', extractedText: null });
    expect(r.body.data.accepted[0].processingNote).toMatch(/Text extraction failed.*enter the module content manually/);
    const dl = await call('GET', `/api/admin/modules/${id}/files/${r.body.data.accepted[0].id}/download`, 'teacher');
    expect(dl.raw.equals(data)).toBe(true);
    const { workerStats } = await import('../../src/services/moduleFiles');
    expect(workerStats().live).toBe(0);
    expect(workerStats().last).toMatchObject({ pid: undefined, timedOut: false }); // it never had a process

    // and the real worker still works afterwards
    const ok = await call('POST', `/api/admin/modules/${id}/upload`, 'teacher', { files: [{ name: 'ok.txt', type: MIME.txt, data: Buffer.from('Extracted fine.') }] });
    expect(ok.body.data.accepted[0]).toMatchObject({ processingStatus: 'EXTRACTED', extractedText: 'Extracted fine.' });
    expect(workerStats().live).toBe(0);
  }, 15_000);
});

describe('authored modules survive their author and curriculum reseeds', () => {
  it('keeps an authored module and learner progress after creator deletion and reseed; admins can still manage it', async () => {
    const author = await db.user.create({ data: { email: 'leaving.teacher@example.invalid', name: 'Leaving Teacher', password: 'x', role: 'TEACHER' } });
    ids.leaving = author.id;
    const created = await call('POST', '/api/admin/modules', 'leaving', { json: { ...baseModule, title: 'Orphaned But Kept', content: 'Kept material.', publish: true } });
    expect(created.body.data.status).toBe('PUBLISHED');
    const modId = created.body.data.id;
    const lessonId = (await db.lesson.findFirstOrThrow({ where: { moduleId: modId } })).id;
    expect((await call('POST', `/api/modules/${modId}/lessons/${lessonId}/complete`, 'student')).status).toBe(200);

    const { buildUserDeletionOps } = await import('../../src/services/userDeletion');
    await db.$transaction(buildUserDeletionOps(db, author.id));
    expect(await db.module.findUniqueOrThrow({ where: { id: modId } })).toMatchObject({ createdById: null, origin: 'AUTHORED', status: 'PUBLISHED' });

    execFileSync(process.execPath, ['--import', 'tsx', resolve('prisma/reseedModules.ts')], { env: testDb.cliEnv, stdio: 'pipe' });

    expect(await db.module.count({ where: { id: modId } })).toBe(1);
    expect(await db.lessonProgress.count({ where: { lessonId, userId: ids.student } })).toBe(1);
    const studentView = await call('GET', `/api/modules/${modId}`, 'student');
    expect(studentView.status).toBe(200);
    expect(studentView.body.data).toMatchObject({ isCustom: true });
    expect(studentView.body.data.lessons[0].completed).toBe(true);
    // the curriculum itself was regenerated
    expect(await db.module.count({ where: { origin: 'BUILTIN' } })).toBe(15);

    const adminList = await call('GET', '/api/admin/modules', 'admin');
    expect(adminList.body.data.find((m: any) => m.id === modId)).toMatchObject({ isPredefined: false, canManage: true, createdBy: null });
    expect((await call('PUT', `/api/admin/modules/${modId}`, 'admin', { json: { ...baseModule, title: 'Orphaned But Kept', content: 'Adopted by admin.' } })).status).toBe(200);
    expect((await call('PUT', `/api/admin/modules/${modId}`, 'teacher', { json: { ...baseModule, title: 'Orphaned But Kept', content: 'x' } })).status).toBe(403);
  }, 60_000);
});
