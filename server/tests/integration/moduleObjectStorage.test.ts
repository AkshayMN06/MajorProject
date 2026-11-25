import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { testDatabase } from '../fixtures/testDatabase';
import { pdfWith, MIME } from '../fixtures/moduleDocuments';

// Direct-to-storage uploads and signed downloads (the Supabase Storage path
// used on Vercel), with the Supabase client replaced by an in-memory bucket.
// Real routers, auth, validation, extraction worker and PostgreSQL.
const store = vi.hoisted(() => ({ objects: new Map<string, Buffer>(), bucketCreated: false }));

vi.mock('@supabase/supabase-js', () => {
  const bucketApi = {
    upload: async (path: string, body: Buffer) => { store.objects.set(path, Buffer.from(body)); return { data: { path }, error: null }; },
    createSignedUrl: async (path: string, _expires: number, opts?: { download?: string }) =>
      store.objects.has(path)
        ? { data: { signedUrl: `https://storage.example/signed/${path}?download=${encodeURIComponent(opts?.download ?? '')}` }, error: null }
        : { data: null, error: new Error('not found') },
    createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://storage.example/upload/${path}?token=t`, token: 't', path }, error: null }),
    download: async (path: string) => {
      const b = store.objects.get(path);
      return b ? { data: new Blob([b]), error: null } : { data: null, error: new Error('Object not found') };
    },
    move: async (from: string, to: string) => {
      const b = store.objects.get(from);
      if (!b) return { error: new Error('Object not found') };
      store.objects.delete(from);
      store.objects.set(to, b);
      return { error: null };
    },
    remove: async (paths: string[]) => { paths.forEach((p) => store.objects.delete(p)); return { data: [], error: null }; },
  };
  return {
    createClient: () => ({
      storage: {
        getBucket: async () => ({ data: store.bucketCreated ? { id: 'module-files' } : null, error: null }),
        createBucket: async () => { store.bucketCreated = true; return { data: {}, error: null }; },
        from: () => bucketApi,
      },
    }),
  };
});

const testDb = testDatabase('objstore');
const db = new PrismaClient({ datasourceUrl: testDb.url });
let app: express.Express;
let secret: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: testDb.cliEnv, stdio: 'pipe' });
  vi.stubEnv('DATABASE_URL', testDb.url);
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.example');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  vi.stubEnv('MODULE_FILE_MAX_MB', '1');
  const [{ default: adminModules }, { default: modules }, envModule] = await Promise.all([
    import('../../src/routes/adminModules.routes'),
    import('../../src/routes/modules.routes'),
    import('../../src/config/env'),
  ]);
  secret = envModule.env.JWT_SECRET;
  app = express();
  app.use(express.json());
  app.use('/api/admin/modules', adminModules);
  app.use('/api/modules', modules);
  for (const [name, role] of [['teacher', 'TEACHER'], ['student', 'USER']] as const) {
    ids[name] = (await db.user.create({ data: { email: `${name}@example.invalid`, name, password: 'x', role } })).id;
  }
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
  await testDb.drop();
  vi.unstubAllEnvs();
});

function call(method: string, path: string, as: string, json?: unknown): Promise<{ status: number; body: any; headers: Record<string, any> }> {
  return new Promise((done, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = method;
    req.url = path;
    const payload = json === undefined ? null : Buffer.from(JSON.stringify(json));
    req.headers = { authorization: `Bearer ${jwt.sign({ id: ids[as] }, secret)}`, ...(payload ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {}) };
    req.complete = true;
    if (payload) req.push(payload);
    req.push(null);
    const res = new ServerResponse(req);
    res.end = ((chunk?: any) => {
      let body: any = null;
      try { body = chunk ? JSON.parse(String(chunk)) : null; } catch { /* redirect bodies */ }
      done({ status: res.statusCode, body, headers: res.getHeaders() });
      return res;
    }) as any;
    (app as any)(req, res, reject);
  });
}

describe('direct uploads to object storage', () => {
  it('advertises direct uploads', async () => {
    const r = await call('GET', '/api/admin/modules/upload-config', 'teacher');
    expect(r.body.data).toMatchObject({ direct: true, maxFileMb: 1, maxFiles: 10 });
  });

  it('pre-checks declared files and signs a staging URL for each valid one', async () => {
    const mod = await call('POST', '/api/admin/modules', 'teacher', { title: 'Storage Module', description: 'd', category: 'Cryptography', difficulty: 'Beginner', learningObjectives: '- o' });
    ids.module = mod.body.data.id;

    const r = await call('POST', `/api/admin/modules/${ids.module}/upload-urls`, 'teacher', {
      files: [
        { name: 'Lecture.pdf', type: MIME.pdf, size: 2000 },
        { name: 'broken.pdf', type: MIME.pdf, size: 50 },
        { name: 'tool.exe', type: 'application/octet-stream', size: 10 },
        { name: 'huge.pdf', type: MIME.pdf, size: 5 * 1024 * 1024 },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.data.targets.map((t: any) => [t.index, t.originalFileName])).toEqual([[0, 'Lecture.pdf'], [1, 'broken.pdf']]);
    expect(r.body.data.targets[0].uploadId).toMatch(/^staging\/[0-9a-f-]{36}\.pdf$/);
    expect(r.body.data.rejected.map((x: any) => x.originalFileName)).toEqual(['tool.exe', 'huge.pdf']);
    expect(store.bucketCreated).toBe(true);
    ids.goodUpload = r.body.data.targets[0].uploadId;
    ids.badUpload = r.body.data.targets[1].uploadId;
    expect((await call('POST', `/api/admin/modules/${ids.module}/upload-urls`, 'student', { files: [{ name: 'a.pdf', type: MIME.pdf, size: 1 }] })).status).toBe(403);
  });

  it('processes uploaded objects: extracts valid ones into originals, discards rejected and unknown ones', async () => {
    // What the browser does with the signed URLs.
    const pdf = await pdfWith('Uploaded straight to storage.');
    store.objects.set(ids.goodUpload, pdf);
    store.objects.set(ids.badUpload, Buffer.from('%PDF-1.7 not really'));

    const r = await call('POST', `/api/admin/modules/${ids.module}/upload-complete`, 'teacher', {
      uploads: [
        { uploadId: ids.goodUpload, name: 'Lecture.pdf', type: MIME.pdf },
        { uploadId: ids.badUpload, name: 'broken.pdf', type: MIME.pdf },
        { uploadId: 'staging/00000000-0000-0000-0000-000000000000.pdf', name: 'never-sent.pdf', type: MIME.pdf },
        { uploadId: '../originals/x.pdf', name: 'sneaky.pdf', type: MIME.pdf },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.body.data.accepted).toHaveLength(1);
    expect(r.body.data.accepted[0]).toMatchObject({ originalFileName: 'Lecture.pdf', processingStatus: 'EXTRACTED' });
    expect(r.body.data.accepted[0].extractedText).toContain('Uploaded straight to storage.');
    expect(r.body.data.rejected.map((x: any) => x.originalFileName)).toEqual(['broken.pdf', 'never-sent.pdf', 'sneaky.pdf']);
    expect(JSON.stringify(r.body)).not.toMatch(/staging\/|originals\//);

    const keys = [...store.objects.keys()];
    expect(keys.filter((k) => k.startsWith('staging/'))).toEqual([]); // moved or discarded
    expect(keys.filter((k) => k.startsWith('originals/'))).toHaveLength(1);
    const row = await db.moduleFile.findFirstOrThrow({ where: { moduleId: ids.module } });
    expect(store.objects.get(`originals/${row.storedFileName}`)!.equals(pdf)).toBe(true);
    ids.file = row.id;
  });

  it('downloads redirect to a short-lived signed URL, only where the caller may read the file', async () => {
    const teacher = await call('GET', `/api/admin/modules/${ids.module}/files/${ids.file}/download`, 'teacher');
    expect(teacher.status).toBe(302);
    expect(teacher.headers.location).toMatch(/^https:\/\/storage\.example\/signed\/originals\/[0-9a-f-]{36}\.pdf\?download=Lecture\.pdf$/);

    // Draft: hidden from students even with the ids.
    expect((await call('GET', `/api/modules/${ids.module}/files/${ids.file}/download`, 'student')).status).toBe(404);
    expect((await call('PATCH', `/api/admin/modules/${ids.module}/publish`, 'teacher')).status).toBe(200);
    const student = await call('GET', `/api/modules/${ids.module}/files/${ids.file}/download`, 'student');
    expect(student.status).toBe(302);
  });

  it('removing a file removes its original from storage', async () => {
    const extra = await call('POST', `/api/admin/modules/${ids.module}/upload-urls`, 'teacher', { files: [{ name: 'notes.txt', type: MIME.txt, size: 5 }] });
    const uploadId = extra.body.data.targets[0].uploadId;
    store.objects.set(uploadId, Buffer.from('notes'));
    const done = await call('POST', `/api/admin/modules/${ids.module}/upload-complete`, 'teacher', { uploads: [{ uploadId, name: 'notes.txt', type: MIME.txt }] });
    const fileId = done.body.data.accepted[0].id;
    const stored = (await db.moduleFile.findUniqueOrThrow({ where: { id: fileId } })).storedFileName;
    expect(store.objects.has(`originals/${stored}`)).toBe(true);
    expect((await call('DELETE', `/api/admin/modules/${ids.module}/files/${fileId}`, 'teacher')).status).toBe(200);
    expect(store.objects.has(`originals/${stored}`)).toBe(false);
  });
});
