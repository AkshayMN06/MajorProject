import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { testDatabase } from '../fixtures/testDatabase';

// Join concurrency and hard-refresh recovery against a fresh PostgreSQL schema
// built from the committed migrations: real conditional updates, real
// persisted round state produced by sessionActions. Requests are injected
// in-process through the real session router + authenticate middleware.
const fixtureDir = mkdtempSync(join(tmpdir(), 'cyberlearn-recovery-test-'));
const testDb = testDatabase('recovery');
const databaseUrl = testDb.url;
const db = new PrismaClient({ datasourceUrl: databaseUrl });

let app: express.Express;
let actions: typeof import('../../src/services/sessionActions');
let secret: string;
let scenarioId: string;
const users: Record<string, string> = {};

beforeAll(async () => {
  execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    env: testDb.cliEnv,
    stdio: 'pipe',
  });
  vi.stubEnv('DATABASE_URL', databaseUrl);
  const [{ default: sessionRoutes }, envModule] = await Promise.all([
    import('../../src/routes/session.routes'),
    import('../../src/config/env'),
  ]);
  actions = await import('../../src/services/sessionActions');
  secret = envModule.env.JWT_SECRET;
  app = express();
  app.use(express.json());
  app.use('/api/sessions', sessionRoutes);

  for (const name of ['host', 'j1', 'j2', 'j3', 'j4', 'j5', 'solo', 'stranger']) {
    const u = await db.user.create({ data: { email: `${name}@example.invalid`, name: `User ${name}`, password: 'fixture-hash' } });
    users[name] = u.id;
  }
  const scenario = await db.scenario.create({
    data: {
      name: 'Recovery fixture', description: 'Fixture', category: 'Web Security', difficulty: 'Easy',
      targetSystem: 'Fixture', context: 'Fixture',
      attackOptions: [{ id: 'atk-secret', name: 'Hidden attack name', description: 'Fixture' }],
      defenseOptions: [{ id: 'def-1', name: 'Defense', description: 'Fixture' }],
    },
  });
  scenarioId = scenario.id;
  await db.rule.create({
    data: { scenarioId, attackType: 'atk-secret', defenseType: 'def-1', outcome: 'defended', explanation: 'Fixture', scoreModifier: 0 },
  });
}, 30_000);

afterAll(async () => {
  await db.$disconnect();
  await testDb.drop();
  vi.unstubAllEnvs();
  rmSync(fixtureDir, { recursive: true, force: true });
});

function call(method: 'GET' | 'POST', path: string, as: string, body?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolvePromise, reject) => {
    const req = new IncomingMessage(new Socket());
    const payload = body === undefined ? '' : JSON.stringify(body);
    req.method = method;
    req.url = path;
    req.headers = {
      authorization: `Bearer ${jwt.sign({ id: users[as] }, secret)}`,
      ...(payload ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(payload)) } : {}),
    };
    if (payload) req.push(payload);
    req.push(null);
    const res = new ServerResponse(req);
    res.end = ((chunk?: any) => {
      resolvePromise({ status: res.statusCode, body: JSON.parse(String(chunk)) });
      return res;
    }) as any;
    (app as any)(req, res, reject);
  });
}

let code = 1000;
async function session(data: Record<string, unknown>) {
  return db.session.create({ data: { sessionCode: `CYB-${++code}`, totalScenarios: 1, scenarioIds: [scenarioId], ...data } as any });
}

const FORBIDDEN_IN_RESUME = /roundState|scenarioIds|currentScenario|atk-secret|Hidden attack name|attackOptions|password|email/;

describe('POST /api/sessions/join concurrency', () => {
  it('lets exactly one of five simultaneous joiners claim the defender slot', async () => {
    const s = await session({ attackerId: users.host, status: 'WAITING_FOR_PARTICIPANT' });
    const joiners = ['j1', 'j2', 'j3', 'j4', 'j5'];
    const results = await Promise.all(joiners.map((j) => call('POST', '/api/sessions/join', j, { sessionCode: s.sessionCode })));

    const winners = results.filter((r) => r.status === 200);
    expect(winners).toHaveLength(1);
    for (const r of results.filter((r) => r.status !== 200)) {
      expect(r.status).toBe(400);
      expect(r.body.success).toBe(false);
    }
    const after = await db.session.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.status).toBe('SESSION_READY');
    expect(winners[0].body.data.defenderName).toBe(`User ${joiners.find((j) => users[j] === after.defenderId)}`);
    expect(JSON.stringify(winners[0].body)).not.toMatch(/password|email/);
    // Retire it so the winner's later resumable checks aren't affected.
    await db.session.update({ where: { id: s.id }, data: { status: 'ASSESSMENT_COMPLETE' } });
  });
});

describe('GET /api/sessions/resumable', () => {
  it('resumes a solo attacker in attack selection with safe metadata only', async () => {
    const s = await session({ attackerId: users.solo, defenderId: users.solo, mode: 'SOLO', soloRole: 'ATTACKER', status: 'SESSION_READY', attackerReady: true, defenderReady: true });
    await actions.loadNextScenario(s.id, s);

    const { status, body } = await call('GET', '/api/sessions/resumable', 'solo');
    expect(status).toBe(200);
    expect(body.data.activeSession).toMatchObject({ sessionId: s.id, status: 'ATTACK_SELECTION', mode: 'SOLO', role: 'attacker', currentRound: 1 });
    expect(JSON.stringify(body)).not.toMatch(FORBIDDEN_IN_RESUME);
    await db.session.update({ where: { id: s.id }, data: { status: 'ASSESSMENT_COMPLETE' } });
  });

  it('resumes a solo defender (role from soloRole, not identity) in defense selection', async () => {
    const s = await session({ attackerId: users.solo, defenderId: users.solo, mode: 'SOLO', soloRole: 'DEFENDER', status: 'SESSION_READY', attackerReady: true, defenderReady: true });
    await actions.loadNextScenario(s.id, s); // system attack already chosen -> DEFENSE_SELECTION

    const { body } = await call('GET', '/api/sessions/resumable', 'solo');
    expect(body.data.activeSession).toMatchObject({ sessionId: s.id, status: 'DEFENSE_SELECTION', role: 'defender' });
    expect(JSON.stringify(body)).not.toMatch(FORBIDDEN_IN_RESUME);
    await db.session.update({ where: { id: s.id }, data: { status: 'ASSESSMENT_COMPLETE' } });
  });

  it('resumes both paired participants mid-round with their own roles and hides the pending attack', async () => {
    const s = await session({ attackerId: users.host, defenderId: users.j1, status: 'SESSION_READY', attackerReady: true, defenderReady: true });
    await actions.loadNextScenario(s.id, s);
    await actions.submitAttack(s.id, users.host, 'atk-secret'); // -> DEFENSE_SELECTION with a pending choice persisted

    const attacker = await call('GET', '/api/sessions/resumable', 'host');
    const defender = await call('GET', '/api/sessions/resumable', 'j1');
    expect(attacker.body.data.activeSession).toMatchObject({ sessionId: s.id, status: 'DEFENSE_SELECTION', role: 'attacker', attackerName: 'User host', defenderName: 'User j1' });
    expect(defender.body.data.activeSession).toMatchObject({ sessionId: s.id, status: 'DEFENSE_SELECTION', role: 'defender' });
    expect(JSON.stringify(attacker.body) + JSON.stringify(defender.body)).not.toMatch(FORBIDDEN_IN_RESUME);

    // Finish the round: RESULT_GENERATED is also resumable, with scores.
    await actions.submitDefense(s.id, users.j1, 'def-1');
    const afterRound = await call('GET', '/api/sessions/resumable', 'j1');
    expect(afterRound.body.data.activeSession).toMatchObject({ sessionId: s.id, status: 'RESULT_GENERATED', role: 'defender' });
    expect(afterRound.body.data.activeSession).toHaveProperty('defenderScore');
    expect(JSON.stringify(afterRound.body)).not.toMatch(FORBIDDEN_IN_RESUME);
    await db.session.update({ where: { id: s.id }, data: { status: 'ASSESSMENT_COMPLETE' } });
  });

  it('does not offer a legacy mid-round session that has no persisted round state', async () => {
    await session({ attackerId: users.j2, defenderId: users.j3, status: 'ATTACK_SELECTION', attackerReady: true, defenderReady: true });
    const { body } = await call('GET', '/api/sessions/resumable', 'j2');
    expect(body.data.activeSession).toBeNull();
  });

  it('keeps pre-play rehydration (waiting room) unchanged', async () => {
    const s = await session({ attackerId: users.j4, status: 'WAITING_FOR_PARTICIPANT' });
    const { body } = await call('GET', '/api/sessions/resumable', 'j4');
    expect(body.data.activeSession).toMatchObject({ sessionId: s.id, status: 'WAITING_FOR_PARTICIPANT', role: 'attacker', defenderName: null });
  });

  it('never returns another user’s session', async () => {
    const { body } = await call('GET', '/api/sessions/resumable', 'stranger');
    expect(body.data).toEqual({ activeSession: null, pendingPostTestSession: null });
  });
});
