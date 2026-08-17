import { PrismaClient } from '@prisma/client';
import { SCENARIOS } from './scenarioData';
import { buildRuleRows } from './ruleGeneration';

const prisma = new PrismaClient();

async function main() {
  console.log(`Reseeding ${SCENARIOS.length} scenarios...`);

  // Clear assessment-related tables (dependent -> independent order) so the
  // new scenario library can be inserted without FK conflicts. Users,
  // Modules, and Lessons (Practice Labs content) are left untouched.
  await prisma.score.deleteMany();
  await prisma.event.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.analytics.deleteMany();
  await prisma.session.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.scenario.deleteMany();

  for (const sData of SCENARIOS) {
    const scenario = await prisma.scenario.create({
      data: {
        name: sData.name,
        description: sData.description,
        category: sData.category,
        difficulty: sData.difficulty,
        targetSystem: sData.targetSystem,
        context: sData.context,
        attackOptions: sData.attackOptions as any,
        defenseOptions: sData.defenseOptions as any,
      },
    });

    const rulesData = buildRuleRows(scenario.id, sData);
    await prisma.rule.createMany({ data: rulesData });
  }

  console.log('Scenario reseed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
