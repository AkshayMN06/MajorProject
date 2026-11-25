import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { consumeResetToken } from '../../src/services/passwordReset';
import { buildUserDeletionOps } from '../../src/services/userDeletion';
import { testDatabase, addFailingTrigger } from '../fixtures/testDatabase';

// Real PostgreSQL (fresh test schema, committed migrations) so FK constraints and
// transaction semantics are the database's, not a mock's.
const fixtureDir = mkdtempSync(join(tmpdir(), 'cyberlearn-reset-test-'));
const testDb = testDatabase('reset');
const databaseUrl = testDb.url;
const db = new PrismaClient({ datasourceUrl: databaseUrl });

beforeAll(() => {
  execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    env: testDb.cliEnv,
    stdio: 'pipe',
  });
}, 30_000);

afterAll(async () => {
  await db.$disconnect();
  await testDb.drop();
  rmSync(fixtureDir, { recursive: true, force: true });
});

let seq = 0;
const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

async function userWithToken(opts: { expiresInMs?: number; usedAt?: Date } = {}) {
  const n = ++seq;
  const user = await db.user.create({
    data: { email: `reset-${n}@example.invalid`, name: `Reset ${n}`, password: 'old-hash', failedLoginCount: 3, lockedUntil: new Date(Date.now() + 60_000) },
  });
  const raw = `raw-token-${n}`;
  const token = await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 60_000)), usedAt: opts.usedAt },
  });
  return { user, token, tokenHash: hash(raw) };
}

describe('consumeResetToken', () => {
  it('lets exactly one of several concurrent submissions succeed', async () => {
    const { user, token, tokenHash } = await userWithToken();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => consumeResetToken(db, tokenHash, `new-hash-${i}`))
    );
    const winners = results.filter((r) => r.status === 'fulfilled' && r.value === user.id);
    expect(winners).toHaveLength(1);

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.password).toMatch(/^new-hash-\d$/);
    expect(after.failedLoginCount).toBe(0);
    expect(after.lockedUntil).toBeNull();
    expect((await db.passwordResetToken.findUniqueOrThrow({ where: { id: token.id } })).usedAt).not.toBeNull();
    // A later replay of the same token fails cleanly.
    expect(await consumeResetToken(db, tokenHash, 'replay')).toBeNull();
  });

  it('rejects unknown, expired and already-used tokens without changing the password', async () => {
    const expired = await userWithToken({ expiresInMs: -1_000 });
    const used = await userWithToken({ usedAt: new Date() });
    expect(await consumeResetToken(db, hash('never-issued'), 'x')).toBeNull();
    expect(await consumeResetToken(db, expired.tokenHash, 'x')).toBeNull();
    expect(await consumeResetToken(db, used.tokenHash, 'x')).toBeNull();
    for (const { user } of [expired, used]) {
      expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).password).toBe('old-hash');
    }
  });

  it('invalidates the user’s other outstanding tokens', async () => {
    const { user, tokenHash } = await userWithToken();
    const other = await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash(`other-${seq}`), expiresAt: new Date(Date.now() + 60_000) },
    });
    expect(await consumeResetToken(db, tokenHash, 'new')).toBe(user.id);
    expect((await db.passwordResetToken.findUniqueOrThrow({ where: { id: other.id } })).usedAt).not.toBeNull();
  });

  it('rolls back the token claim when the password write fails, so a retry still works', async () => {
    const { user, token, tokenHash } = await userWithToken();
    const remove_test_fail_password = await addFailingTrigger(db, 'test_fail_password', 'users', 'UPDATE OF "password"');
    try {
      await expect(consumeResetToken(db, tokenHash, 'new')).rejects.toThrow();
    } finally {
      await remove_test_fail_password();
    }
    expect((await db.passwordResetToken.findUniqueOrThrow({ where: { id: token.id } })).usedAt).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).password).toBe('old-hash');

    expect(await consumeResetToken(db, tokenHash, 'new')).toBe(user.id);
  });
});

describe('account deletion with dependent rows', () => {
  it('deletes a user who has lesson progress, reset tokens and a security event', async () => {
    const { user } = await userWithToken();
    const module = await db.module.create({
      data: { name: 'M', description: 'D', category: 'Web Security', difficulty: 'Easy', duration: 10, type: 'lesson', content: {}, order: 1 },
    });
    const lesson = await db.lesson.create({ data: { moduleId: module.id, title: 'L', content: 'C', type: 'theory', order: 1 } });
    await db.lessonProgress.create({ data: { userId: user.id, lessonId: lesson.id } });
    const event = await db.securityEvent.create({ data: { userId: user.id, email: user.email, type: 'LOGIN_SUCCESS' } });
    await db.session.create({ data: { attackerId: user.id, defenderId: user.id, mode: 'SOLO', soloRole: 'ATTACKER' } });

    await db.$transaction(buildUserDeletionOps(db, user.id));

    expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await db.lessonProgress.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.session.count({ where: { attackerId: user.id } })).toBe(0);
    // Audit trail retained, detached from the deleted account (ON DELETE SET NULL).
    expect(await db.securityEvent.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ userId: null, email: user.email });
    // Shared curriculum rows are untouched.
    expect(await db.lesson.count({ where: { id: lesson.id } })).toBe(1);
  });
});
