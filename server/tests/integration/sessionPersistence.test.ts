import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { testDatabase, addFailingTrigger } from '../fixtures/testDatabase';

const fixtureDir = mkdtempSync(join(tmpdir(), 'cyberlearn-session-test-'));
const testDb = testDatabase('session');
const databaseUrl = testDb.url;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
let actions: typeof import('../../src/services/sessionActions');
let scenarioId: string;
let userId: string;

beforeAll(async () => {
  execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    env: testDb.cliEnv,
    stdio: 'pipe',
  });
  vi.stubEnv('DATABASE_URL', databaseUrl);
  actions = await import('../../src/services/sessionActions');

  const user = await db.user.create({
    data: { email: 'session-test@example.invalid', name: 'Session test', password: 'fixture' },
  });
  userId = user.id;
  const scenario = await db.scenario.create({
    data: {
      name: 'Round fixture',
      description: 'Fixture',
      category: 'Web Security',
      difficulty: 'Easy',
      targetSystem: 'Fixture',
      context: 'Fixture',
      attackOptions: [{ id: 'a', name: 'First option', description: 'Fixture' }],
      defenseOptions: [{ id: 'd', name: 'Second option', description: 'Fixture' }],
    },
  });
  scenarioId = scenario.id;
  await db.rule.create({
    data: {
      scenarioId,
      attackType: 'a',
      defenseType: 'd',
      outcome: 'defended',
      explanation: 'Fixture',
      scoreModifier: 0,
    },
  });
}, 15_000);

afterAll(async () => {
  await db.$disconnect();
  await testDb.drop();
  vi.unstubAllEnvs();
  rmSync(fixtureDir, { recursive: true, force: true });
});

async function createSession(soloRole: 'ATTACKER' | 'DEFENDER', participantId = userId) {
  return db.session.create({
    data: {
      attackerId: participantId,
      defenderId: participantId,
      status: 'SESSION_READY',
      mode: 'SOLO',
      soloRole,
      totalScenarios: 1,
      scenarioIds: [scenarioId],
    },
  });
}

describe('Database assessment persistence', () => {
  it('rolls back a failed score write and allows retry without duplicate rows', async () => {
    const session = await createSession('ATTACKER');
    await actions.loadNextScenario(session.id, session);
    const remove_test_fail_score = await addFailingTrigger(db, 'test_fail_score', 'scores', 'INSERT');
    try {
      await expect(actions.submitAttack(session.id, userId, 'a')).rejects.toThrow();
      const failed = await db.session.findUniqueOrThrow({
        where: { id: session.id },
        include: { events: true, attempts: true, scores: true },
      });
      expect(failed.status).toBe('ATTACK_SELECTION');
      expect(failed.events).toHaveLength(0);
      expect(failed.attempts).toHaveLength(0);
      expect(failed.scores).toHaveLength(0);
    } finally {
      await remove_test_fail_score();
    }

    await actions.submitAttack(session.id, userId, 'a');
    const saved = await db.session.findUniqueOrThrow({
      where: { id: session.id },
      include: { events: true, attempts: true, scores: true },
    });
    expect(saved.status).toBe('RESULT_GENERATED');
    expect(saved.events).toHaveLength(1);
    expect(saved.attempts).toHaveLength(1);
    expect(saved.scores).toHaveLength(1);
    expect(actions.getRoomState(saved.roundState)?.result?.outcome).toBe('defended');
  });

  it('persists the chosen system attack and commits only one competing defense decision', async () => {
    const session = await createSession('DEFENDER');
    await actions.loadNextScenario(session.id, session);
    const opened = await db.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(opened.status).toBe('DEFENSE_SELECTION');
    expect(actions.getRoomState(opened.roundState)?.attack?.id).toBe('a');

    const decisions = await Promise.allSettled([
      actions.submitDefense(session.id, userId, 'd'),
      actions.submitDefense(session.id, userId, 'd'),
    ]);
    expect(decisions.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await db.event.count({ where: { sessionId: session.id } })).toBe(1);
    expect(await db.attempt.count({ where: { sessionId: session.id } })).toBe(1);
    expect(await db.score.count({ where: { sessionId: session.id } })).toBe(1);
  }, 15_000);

  it('preserves category totals when a learner resolves rounds in separate sessions concurrently', async () => {
    const participant = await db.user.create({
      data: { email: 'concurrency-test@example.invalid', name: 'Concurrent learner', password: 'fixture' },
    });
    const sessions = await Promise.all([
      createSession('DEFENDER', participant.id),
      createSession('DEFENDER', participant.id),
    ]);
    await Promise.all(sessions.map((session) => actions.loadNextScenario(session.id, session)));
    await Promise.all(sessions.map((session) => actions.submitDefense(session.id, participant.id, 'd')));

    const rows = await db.analytics.findMany({ where: { userId: participant.id, category: 'Web Security' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].totalAttempts).toBe(2);
    expect(rows[0].correctAttempts).toBe(2);
  }, 15_000);

  it('keeps canonical completion and retries failed artifacts without duplicates', async () => {
    const session = await createSession('DEFENDER');
    await actions.loadNextScenario(session.id, session);
    await actions.submitDefense(session.id, userId, 'd');

    const remove_test_fail_snapshot = await addFailingTrigger(db, 'test_fail_snapshot', 'assessment_snapshots', 'INSERT');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(actions.advanceRound(session.id, userId)).resolves.toMatchObject({ complete: true });
      const failed = await db.session.findUniqueOrThrow({ where: { id: session.id } });
      expect(failed.status).toBe('ASSESSMENT_COMPLETE');
      expect(failed.completionArtifactsAt).toBeNull();
      expect(failed.roundState).toBeNull();
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
      await remove_test_fail_snapshot();
    }

    await actions.advanceRound(session.id, userId);
    await actions.advanceRound(session.id, userId);
    const completed = await db.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(completed.completionArtifactsAt).toBeInstanceOf(Date);
    expect(await db.assessmentSnapshot.count({ where: { sessionId: session.id } })).toBe(1);
  });
});
