import { PrismaClient } from '@prisma/client';
import { SCENARIOS } from './scenarioData';
import { buildRuleRows } from './ruleGeneration';
import { MODULES } from './moduleData';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Scenario Assessment content library: 5 modules x 3 difficulties x 10
  // scenarios each, defined in scenarioData.ts.
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
      }
    });

    const rulesData = buildRuleRows(scenario.id, sData);
    await prisma.rule.createMany({
      data: rulesData
    });
  }

  // Modules — one per Scenario.category, with real curriculum content
  // (see moduleData.ts). Kept in sync with reseedModules.ts, which
  // regenerates this table independently on an already-seeded database.
  for (const m of MODULES) {
    const module = await prisma.module.create({
      data: {
        name: m.name,
        description: m.description,
        category: m.category,
        difficulty: m.difficulty,
        duration: m.duration,
        type: m.type,
        content: {},
        order: m.order,
      }
    });

    await prisma.lesson.createMany({
      data: m.lessons.map((l) => ({
        moduleId: module.id,
        title: l.title,
        content: l.content,
        type: l.type,
        order: l.order,
      }))
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
