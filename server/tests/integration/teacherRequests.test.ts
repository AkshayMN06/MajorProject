import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { testDatabase } from '../fixtures/testDatabase';

// Teacher access: signup can only ask for it; an admin approves or rejects.
const testDb = testDatabase('teacherreq');
const db = new PrismaClient({ datasourceUrl: testDb.url });
let app: express.Express;
let secret: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: testDb.cliEnv, stdio: 'pipe' });
  vi.stubEnv('DATABASE_URL', testDb.url);
  const [{ default: auth }, { default: admin }, envModule] = await Promise.all([
    import('../../src/routes/auth.routes'),
    import('../../src/routes/admin.routes'),
    import('../../src/config/env'),
  ]);
  secret = envModule.env.JWT_SECRET;
  app = express();
  app.use(express.json());
  app.use('/api/auth', auth);
  app.use('/api/admin', admin);
  ids.admin = (await db.user.create({ data: { email: 'admin@example.invalid', name: 'admin', password: 'x', role: 'ADMIN' } })).id;
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
  await testDb.drop();
  vi.unstubAllEnvs();
});

function call(method: string, path: string, as?: string, json?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((done, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = method;
    req.url = path;
    const payload = json === undefined ? null : Buffer.from(JSON.stringify(json));
    req.headers = {
      ...(as ? { authorization: `Bearer ${jwt.sign({ id: ids[as] }, secret)}` } : {}),
      ...(payload ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {}),
    };
    req.complete = true;
    if (payload) req.push(payload);
    req.push(null);
    const res = new ServerResponse(req);
    res.end = ((chunk?: any) => {
      done({ status: res.statusCode, body: chunk ? JSON.parse(String(chunk)) : null });
      return res;
    }) as any;
    (app as any)(req, res, reject);
  });
}

const signup = (email: string, requestTeacher?: unknown) =>
  call('POST', '/api/auth/register', undefined, { email, password: 'pw-123456', name: email.split('@')[0], requestTeacher });

describe('teacher access requests', () => {
  it('signup never grants TEACHER, it only queues a request', async () => {
    const t = await signup('teach@example.invalid', true);
    expect(t.status).toBe(201);
    expect(t.body.data.user.role).toBe('USER');
    ids.teach = t.body.data.user.id;
    ids.other = (await signup('other@example.invalid', true)).body.data.user.id;
    // Anything but literal true is not a request; a role in the body is ignored.
    const s = await call('POST', '/api/auth/register', undefined, { email: 'stud@example.invalid', password: 'pw-123456', name: 's', requestTeacher: 'true', role: 'ADMIN' });
    expect(s.body.data.user).toMatchObject({ role: 'USER', teacherRequestedAt: null });
    ids.student = s.body.data.user.id;

    const list = await call('GET', '/api/admin/teacher-requests', 'admin');
    expect(list.body.data.map((r: any) => r.email)).toEqual(['teach@example.invalid', 'other@example.invalid']);
  });

  it('only admins can see or decide requests', async () => {
    expect((await call('GET', '/api/admin/teacher-requests', 'student')).status).toBe(403);
    expect((await call('POST', `/api/admin/teacher-requests/${ids.teach}/approve`, 'student')).status).toBe(403);
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.teach } })).role).toBe('USER');
  });

  it('approve makes TEACHER once; reject leaves USER; both clear the request', async () => {
    expect((await call('POST', `/api/admin/teacher-requests/${ids.teach}/approve`, 'admin')).status).toBe(200);
    expect((await call('POST', `/api/admin/teacher-requests/${ids.teach}/approve`, 'admin')).status).toBe(404);
    expect((await call('POST', `/api/admin/teacher-requests/${ids.other}/reject`, 'admin')).status).toBe(200);
    expect((await call('POST', `/api/admin/teacher-requests/${ids.student}/approve`, 'admin')).status).toBe(404); // never asked
    expect((await call('POST', `/api/admin/teacher-requests/${ids.teach}/promote`, 'admin')).status).toBe(404);

    const rows = await db.user.findMany({ where: { id: { in: [ids.teach, ids.other, ids.student] } }, select: { id: true, role: true, teacherRequestedAt: true } });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[ids.teach]).toMatchObject({ role: 'TEACHER', teacherRequestedAt: null });
    expect(byId[ids.other]).toMatchObject({ role: 'USER', teacherRequestedAt: null });
    expect(byId[ids.student].role).toBe('USER');
    expect((await call('GET', '/api/admin/teacher-requests', 'admin')).body.data).toEqual([]);
  });
});
