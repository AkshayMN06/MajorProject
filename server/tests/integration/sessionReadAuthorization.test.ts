import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket, Server as NetServer } from 'net';

// Fail loudly if anything in this suite tries to bind a port (sandboxed CI
// returns EPERM for listen).
NetServer.prototype.listen = function () {
  throw new Error('sessionReadAuthorization tests must not bind a port');
} as any;

// Request-level checks for every session read endpoint: real routers and
// real authenticate middleware, Prisma replaced by synthetic fixtures. The
// session mocks honour `select` so projection is actually tested. Requests
// are injected in-process — no port is ever bound.
const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  session: { findUnique: vi.fn(), findMany: vi.fn() },
  event: { findFirst: vi.fn() },
  score: { findFirst: vi.fn() },
  buildAssessmentReport: vi.fn(),
}));

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mocks) }));
vi.mock('../../src/services/reportBuilder', () => ({ buildAssessmentReport: mocks.buildAssessmentReport }));

import { env } from '../../src/config/env';
import sessionRoutes from '../../src/routes/session.routes';
import actionRoutes from '../../src/routes/action.routes';

const user = (id: string) => ({
  id,
  name: `User ${id}`,
  email: `${id}@example.test`,
  password: 'hashed-secret',
  role: 'USER',
  failedLoginCount: 2,
  lockedUntil: null,
});
const USERS: Record<string, any> = { attacker: user('attacker'), defender: user('defender'), stranger: user('stranger'), solo: user('solo') };

const SESSIONS: Record<string, any> = {
  paired: {
    id: 'paired', sessionCode: 'CYB-1000', attackerId: 'attacker', defenderId: 'defender',
    status: 'RESULT_GENERATED', mode: 'PAIRED', soloRole: null, difficulty: 'Easy', module: 'Web Security',
    currentScenarioIndex: 0, totalScenarios: 5, attackerReady: true, defenderReady: true,
    scenarioIds: ['s1', 's2'], roundState: { attackChoice: 'a1', scenarioId: 's1' }, completionArtifactsAt: null, attackerScore: 10, defenderScore: 5, createdAt: new Date(), completedAt: null,
    attacker: USERS.attacker, defender: USERS.defender, events: [{ id: 'e1', turnId: 1 }],
  },
  solo: {
    id: 'solo', sessionCode: 'CYB-2000', attackerId: 'solo', defenderId: 'solo',
    status: 'ASSESSMENT_COMPLETE', mode: 'SOLO', soloRole: 'DEFENDER', difficulty: 'Easy', module: null,
    currentScenarioIndex: 4, totalScenarios: 5, attackerReady: true, defenderReady: true,
    scenarioIds: ['s1'], attackerScore: 0, defenderScore: 40, createdAt: new Date(), completedAt: new Date(),
    attacker: USERS.solo, defender: USERS.solo, events: [],
  },
};

function applySelect(row: any, select: any): any {
  if (!row) return row;
  return Object.fromEntries(
    Object.entries(select).map(([k, v]: [string, any]) => [k, v === true ? row[k] : applySelect(row[k], v.select)])
  );
}

const token = (id: string) => jwt.sign({ id }, env.JWT_SECRET);

const app = express();
app.use('/api/sessions', sessionRoutes);
app.use('/api', actionRoutes);

// Drives the app with a real IncomingMessage/ServerResponse pair on an
// unconnected socket and captures whatever res.end() receives.
function request(path: string, as?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = 'GET';
    req.url = path;
    req.headers = as ? { authorization: `Bearer ${token(as)}` } : {};
    req.push(null);
    const res = new ServerResponse(req);
    res.end = ((chunk?: any) => {
      try {
        resolve({ status: res.statusCode, body: JSON.parse(String(chunk)) });
      } catch (err) {
        reject(err);
      }
      return res;
    }) as any;
    (app as any)(req, res, reject);
  });
}
const get = (path: string, as: string) => request(path, as);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.findUnique.mockImplementation(async ({ where }: any) => USERS[where.id] ?? null);
  mocks.session.findUnique.mockImplementation(async ({ where, select }: any) => {
    const row = SESSIONS[where.id] ?? null;
    return select ? applySelect(row, select) : row;
  });
  mocks.session.findMany.mockImplementation(async ({ select }: any) =>
    [SESSIONS.paired].map((row) => (select ? applySelect(row, select) : row))
  );
  mocks.event.findFirst.mockResolvedValue({ turnId: 1, scenarioId: 's1', attackerChoice: 'a', defenderChoice: 'd', outcome: 'defended', timeTaken: 3, timestamp: new Date() });
  mocks.score.findFirst.mockResolvedValue({ totalScore: 5 });
  mocks.buildAssessmentReport.mockResolvedValue({ sessionId: 'paired', rounds: [] });
});

const readPaths = (id: string) => [
  `/api/sessions/${id}`,
  `/api/sessions/${id}/report`,
  `/api/assessment-report/${id}`,
  `/api/round-result?sessionId=${id}`,
];

describe('session read authorization', () => {
  for (const as of ['attacker', 'defender']) {
    it(`${as} can read every paired-session resource`, async () => {
      for (const path of readPaths('paired')) {
        const { status, body } = await get(path, as);
        expect(status, path).toBe(200);
        expect(body.success, path).toBe(true);
      }
    });
  }

  it('solo participant can read every resource of their own session', async () => {
    for (const path of readPaths('solo')) {
      expect((await get(path, 'solo')).status, path).toBe(200);
    }
  });

  it('unrelated user is denied everywhere and no data is built', async () => {
    for (const id of ['paired', 'solo']) {
      for (const path of readPaths(id)) {
        const { status, body } = await get(path, 'stranger');
        expect(status, path).toBe(403);
        expect(body).toEqual({ success: false, error: 'You are not a participant in this session' });
      }
    }
    expect(mocks.buildAssessmentReport).not.toHaveBeenCalled();
    expect(mocks.event.findFirst).not.toHaveBeenCalled();
  });

  it('missing session returns 404 on every alias', async () => {
    for (const path of readPaths('nope')) {
      const { status, body } = await get(path, 'attacker');
      expect(status, path).toBe(404);
      expect(body.success).toBe(false);
    }
  });

  it('unauthenticated request is rejected', async () => {
    for (const path of [...readPaths('paired'), '/api/sessions/active']) {
      expect((await request(path)).status, path).toBe(401);
    }
  });

  it('active sessions are filtered to the caller and exclude internal round state', async () => {
    const { status, body } = await get('/api/sessions/active', 'defender');
    expect(status).toBe(200);
    const { where } = mocks.session.findMany.mock.calls[0][0];
    expect(where).toEqual({ OR: [{ attackerId: 'defender' }, { defenderId: 'defender' }], status: { not: 'ASSESSMENT_COMPLETE' } });
    const [row] = body.data;
    for (const hidden of ['scenarioIds', 'roundState', 'completionArtifactsAt', 'attacker', 'defender']) {
      expect(row, hidden).not.toHaveProperty(hidden);
    }
    expect(row).toMatchObject({ id: 'paired', sessionCode: 'CYB-1000', status: 'RESULT_GENERATED', attackerId: 'attacker', defenderId: 'defender', totalScenarios: 5 });
  });

  it('session detail exposes only safe participant and session fields', async () => {
    const { body } = await get('/api/sessions/paired', 'attacker');
    const data = body.data;
    expect(data.attacker).toEqual({ id: 'attacker', name: 'User attacker' });
    expect(data.defender).toEqual({ id: 'defender', name: 'User defender' });
    expect(data).not.toHaveProperty('scenarioIds');
    expect(data).not.toHaveProperty('roundState');
    expect(data).not.toHaveProperty('completionArtifactsAt');
    expect(JSON.stringify(data)).not.toMatch(/hashed-secret|password|email|failedLoginCount|lockedUntil|role"/);
    // authorized contract preserved
    expect(data).toMatchObject({ id: 'paired', sessionCode: 'CYB-1000', status: 'RESULT_GENERATED', attackerScore: 10, events: [{ id: 'e1', turnId: 1 }] });
  });
});
