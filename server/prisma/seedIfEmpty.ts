// Deployment seed: loads the built-in content (scenarios + rules + modules,
// quiz bank, practice labs) only into an empty database, so it is safe to run
// on every deploy and never touches existing data.
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const scenarios = await prisma.scenario.count();
  await prisma.$disconnect();
  if (scenarios > 0) {
    console.log(`Database already has ${scenarios} scenarios — skipping seed.`);
    return;
  }
  for (const script of ['prisma/seed.ts', 'prisma/seedQuiz.ts', 'prisma/seedPractice.ts']) {
    console.log(`Seeding: ${script}`);
    execFileSync(process.execPath, ['--import', 'tsx', script], { stdio: 'inherit', env: process.env });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
