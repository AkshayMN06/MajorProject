import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { testDatabase, addFailingTrigger } from '../fixtures/testDatabase';

// Per-category analytics under contention, on a fresh PostgreSQL schema built from
// the committed migrations. Aggregates are checked against the canonical
// per-round Attempt rows the same rounds wrote.
const fixtureDir = mkdtempSync(join(tmpdir(), 'cyberlearn-analytics-test-'));
const testDb = testDatabase('analytics');
const databaseUrl = testDb.url;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const prismaCli = resolve('node_modules/prisma/build/index.js');

let actions: typeof import('../../src/services/sessionActions');
let AnalyticsEngine: typeof import('../../src/services/analyticsEngine').AnalyticsEngine;
let scenarioId: string;
const CATEGORY = 'Web Security';

function migrate(url: string, schema?: string) {
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', ...(schema ? ['--schema', schema] : [])], {
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'pipe',
  });
}

beforeAll(async () => {
  migrate(databaseUrl);
  vi.stubEnv('DATABASE_URL', databaseUrl);
  actions = await import('../../src/services/sessionActions');
  ({ AnalyticsEngine } = await import('../../src/services/analyticsEngine'));

  const scenario = await db.scenario.create({
    data: {
      name: 'Analytics fixture', description: 'Fixture', category: CATEGORY, difficulty: 'Easy',
      targetSystem: 'Fixture', context: 'Fixture',
      attackOptions: [{ id: 'a', name: 'Attack', description: 'Fixture' }],
      defenseOptions: [{ id: 'd', name: 'Defense', description: 'Fixture' }],
    },
  });
  scenarioId = scenario.id;
  await db.rule.create({ data: { scenarioId, attackType: 'a', defenseType: 'd', outcome: 'breached', explanation: 'Fixture', scoreModifier: 0 } });
}, 30_000);

afterAll(async () => {
  await db.$disconnect();
  await testDb.drop();
  vi.unstubAllEnvs();
  rmSync(fixtureDir, { recursive: true, force: true });
});

let seq = 0;
const newUser = () => db.user.create({ data: { email: `analytics-${++seq}@example.invalid`, name: `Learner ${seq}`, password: 'fixture' } });

// Expected aggregate derived from the canonical Attempt rows.
async function expectedFromAttempts(userId: string) {
  const attempts = await db.attempt.findMany({ where: { userId, scenario: { category: CATEGORY } } });
  const won = (a: { role: string; outcome: string }) => (a.role === 'defender' ? a.outcome === 'defended' : a.outcome === 'breached');
  const total = attempts.length;
  const correct = attempts.filter(won).length;
  return { total, correct, accuracy: (correct / total) * 100, averageTime: attempts.reduce((s, a) => s + a.timeTaken, 0) / total };
}

describe('AnalyticsEngine.updateAnalytics under contention', () => {
  it('first-write contention: 8 concurrent attempts create one row with all 8 counted', async () => {
    const user = await newUser();
    const inputs = Array.from({ length: 8 }, (_, i) => ({ correct: i % 3 === 0, time: i + 1 }));
    await Promise.all(inputs.map((x) => AnalyticsEngine.updateAnalytics(user.id, 'Cryptography', x.correct, x.time)));

    const rows = await db.analytics.findMany({ where: { userId: user.id, category: 'Cryptography' } });
    expect(rows).toHaveLength(1);
    const correct = inputs.filter((x) => x.correct).length;
    expect(rows[0]).toMatchObject({ totalAttempts: 8, correctAttempts: correct });
    expect(rows[0].accuracy).toBeCloseTo((correct / 8) * 100, 9);
    expect(rows[0].averageTime).toBeCloseTo(inputs.reduce((s, x) => s + x.time, 0) / 8, 9);
  });

  it('existing aggregate: 1 initial + 8 concurrent attempts store 9', async () => {
    const user = await newUser();
    await AnalyticsEngine.updateAnalytics(user.id, 'Cryptography', true, 10);
    await Promise.all(Array.from({ length: 8 }, (_, i) => AnalyticsEngine.updateAnalytics(user.id, 'Cryptography', i < 2, 1)));

    const [row] = await db.analytics.findMany({ where: { userId: user.id, category: 'Cryptography' } });
    expect(row).toMatchObject({ totalAttempts: 9, correctAttempts: 3 });
    expect(row.accuracy).toBeCloseTo((3 / 9) * 100, 9);
    expect(row.averageTime).toBeCloseTo((10 + 8) / 9, 9);
  });

  it('the database rejects a second row for the same learner and category', async () => {
    const user = await newUser();
    await AnalyticsEngine.updateAnalytics(user.id, 'Cryptography', true, 1);
    await expect(db.analytics.create({ data: { userId: user.id, category: 'Cryptography' } })).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('concurrent rounds from separate sessions sharing a learner and category', () => {
  async function soloSession(userId: string, soloRole: 'ATTACKER' | 'DEFENDER', secondsAgo: number) {
    const session = await db.session.create({
      data: { attackerId: userId, defenderId: userId, mode: 'SOLO', soloRole, status: 'SESSION_READY', attackerReady: true, defenderReady: true, totalScenarios: 1, scenarioIds: [scenarioId] },
    });
    await actions.loadNextScenario(session.id, session);
    // Backdate the persisted round clock so each round records a distinct time.
    const fresh = await db.session.findUniqueOrThrow({ where: { id: session.id } });
    const room = fresh.roundState as any;
    const past = Date.now() - secondsAgo * 1000;
    await db.session.update({
      where: { id: session.id },
      data: { roundState: soloRole === 'ATTACKER' ? { ...room, attackStartTime: past } : { ...room, defenseStartTime: past } },
    });
    return session.id;
  }

  it('aggregates every round exactly, matching the attempt records', async () => {
    const user = await newUser();
    const attackerSessions = await Promise.all([2, 4, 6, 8].map((s) => soloSession(user.id, 'ATTACKER', s)));
    const defenderSessions = await Promise.all([3, 5, 7, 9].map((s) => soloSession(user.id, 'DEFENDER', s)));

    const results = await Promise.allSettled([
      ...attackerSessions.map((id) => actions.submitAttack(id, user.id, 'a')),
      ...defenderSessions.map((id) => actions.submitDefense(id, user.id, 'd')),
    ]);
    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);

    const rows = await db.analytics.findMany({ where: { userId: user.id, category: CATEGORY } });
    expect(rows).toHaveLength(1);
    const expected = await expectedFromAttempts(user.id);
    expect(expected.total).toBe(8);
    expect(rows[0].totalAttempts).toBe(expected.total);
    expect(rows[0].correctAttempts).toBe(expected.correct);
    expect(rows[0].accuracy).toBeCloseTo(expected.accuracy, 9);
    expect(rows[0].averageTime).toBeCloseTo(expected.averageTime, 9);
    expect(expected.averageTime).toBeGreaterThan(0); // backdating took effect
  });

  it('a round that fails after the analytics write rolls the aggregate back', async () => {
    const user = await newUser();
    const first = await soloSession(user.id, 'ATTACKER', 1);
    await actions.submitAttack(first, user.id, 'a');
    const before = await db.analytics.findUniqueOrThrow({ where: { userId_category: { userId: user.id, category: CATEGORY } } });

    const failing = await soloSession(user.id, 'ATTACKER', 1);
    // Aborts the final session-score write, which runs after analytics in the same transaction.
    const remove_test_fail_totals = await addFailingTrigger(db, 'test_fail_totals', 'sessions', 'UPDATE OF "attackerScore"');
    try {
      await expect(actions.submitAttack(failing, user.id, 'a')).rejects.toThrow();
    } finally {
      await remove_test_fail_totals();
    }
    const after = await db.analytics.findUniqueOrThrow({ where: { userId_category: { userId: user.id, category: CATEGORY } } });
    expect(after).toMatchObject({ totalAttempts: before.totalAttempts, correctAttempts: before.correctAttempts, averageTime: before.averageTime });

    // Retrying the same round then counts it exactly once.
    await actions.submitAttack(failing, user.id, 'a');
    const retried = await db.analytics.findUniqueOrThrow({ where: { userId_category: { userId: user.id, category: CATEGORY } } });
    expect(retried.totalAttempts).toBe(before.totalAttempts + 1);
    expect(retried.totalAttempts).toBe((await expectedFromAttempts(user.id)).total);
  });
});
