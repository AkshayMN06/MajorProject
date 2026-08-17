// Regenerates the `rules` table from the current buildRuleRows() logic
// without touching scenarios, sessions, or any gameplay history — rules are
// derived purely from scenario content + explicitRules.ts, independent of
// everything else in the database.
import { PrismaClient } from '@prisma/client';
import { SCENARIOS } from './scenarioData';
import { buildRuleRows } from './ruleGeneration';

const prisma = new PrismaClient();

async function main() {
  const scenarios = await prisma.scenario.findMany();
  console.log(`Regenerating rules for ${scenarios.length} scenarios...`);

  let totalRules = 0;
  for (const scenario of scenarios) {
    const sData = SCENARIOS.find((s) => s.name === scenario.name);
    if (!sData) {
      console.warn(`No scenarioData entry found for "${scenario.name}" — skipping.`);
      continue;
    }
    await prisma.rule.deleteMany({ where: { scenarioId: scenario.id } });
    const rows = buildRuleRows(scenario.id, sData);
    await prisma.rule.createMany({ data: rows });
    totalRules += rows.length;
  }

  console.log(`Done. ${totalRules} rule rows written.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
