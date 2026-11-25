import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Integration tests run against a disposable PostgreSQL database given by
// TEST_DATABASE_URL (e.g. a local Docker container). Each test file gets its
// own freshly named schema, migrated from the real migrations, and drops it
// when done — files never share data and nothing touches a real database.
export function testDatabase(label: string) {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) {
    throw new Error('TEST_DATABASE_URL must point at a disposable PostgreSQL database (see server/.env.example).');
  }
  const schema = `t_${label}_${randomBytes(4).toString('hex')}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const u = new URL(base);
  u.searchParams.set('schema', schema);
  const url = u.toString();

  return {
    url,
    schema,
    /** Environment for running the Prisma CLI against this schema. */
    cliEnv: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    async drop() {
      const admin = new PrismaClient({ datasourceUrl: base });
      try {
        await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await admin.$disconnect();
      }
    },
  };
}

/**
 * Fault injection: makes every row-level `event` on `table` fail inside the
 * database (so the surrounding transaction must roll back). Returns a
 * function that removes the trigger again.
 */
export async function addFailingTrigger(
  db: Pick<PrismaClient, '$executeRawUnsafe'>,
  name: string,
  table: string,
  event: string, // e.g. 'INSERT' or 'UPDATE OF "password"'
): Promise<() => Promise<void>> {
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION ${name}_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '${name}'; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE ${event} ON "${table}" FOR EACH ROW EXECUTE FUNCTION ${name}_fn()`);
  return async () => {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${name} ON "${table}"`);
  };
}
