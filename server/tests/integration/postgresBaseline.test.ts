import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase } from '../fixtures/testDatabase';

// The PostgreSQL migrations alone must produce exactly the Prisma schema,
// including the database-level rules the app relies on.
const testDb = testDatabase('baseline');
const cli = resolve('node_modules/prisma/build/index.js');
const db = new PrismaClient({ datasourceUrl: testDb.url });

beforeAll(() => {
  execFileSync(process.execPath, [cli, 'migrate', 'deploy'], { env: testDb.cliEnv, stdio: 'pipe' });
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
  await testDb.drop();
});

describe('PostgreSQL baseline migration', () => {
  it('matches schema.prisma with no drift', () => {
    // --exit-code: 0 = identical, 2 = differences (execFileSync throws on non-zero).
    expect(() =>
      execFileSync(process.execPath, [cli, 'migrate', 'diff', '--from-url', testDb.url, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], { env: testDb.cliEnv, stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('enforces one active module per title key while allowing many archived (null) keys', async () => {
    const base = { description: 'd', category: 'c', difficulty: 'Easy', duration: 1, type: 'custom', content: {}, order: 1 };
    await db.module.create({ data: { ...base, name: 'A', activeTitleKey: 'a' } });
    await expect(db.module.create({ data: { ...base, name: 'a', activeTitleKey: 'a' } })).rejects.toMatchObject({ code: 'P2002' });
    await db.module.create({ data: { ...base, name: 'A', activeTitleKey: null, status: 'ARCHIVED' } });
    await db.module.create({ data: { ...base, name: 'A', activeTitleKey: null, status: 'ARCHIVED' } });
    expect(await db.module.count({ where: { name: 'A', status: 'ARCHIVED' } })).toBe(2);
  });

  it('enforces one analytics row per learner and category', async () => {
    const u = await db.user.create({ data: { email: 'baseline@example.invalid', name: 'B', password: 'x' } });
    await db.analytics.create({ data: { userId: u.id, category: 'Web Security' } });
    await expect(db.analytics.create({ data: { userId: u.id, category: 'Web Security' } })).rejects.toMatchObject({ code: 'P2002' });
  });
});
