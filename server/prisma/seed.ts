import { PrismaClient } from '@prisma/client';
import { SCENARIOS } from './scenarioData';
import { buildRuleRows } from './ruleGeneration';

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

  // Modules
  for (let i = 1; i <= 8; i++) {
    const module = await prisma.module.create({
      data: {
        name: `Cyber Security Module ${i}`,
        description: `Learn core concepts for topic ${i}.`,
        category: 'General',
        difficulty: 'Medium',
        duration: 120,
        type: 'theory',
        content: {},
        order: i,
      }
    });

    await prisma.lesson.createMany({
      data: [
        { moduleId: module.id, title: `Lesson 1 for Module ${i}`, content: 'Content 1', type: 'theory', order: 1 },
        { moduleId: module.id, title: `Lesson 2 for Module ${i}`, content: 'Content 2', type: 'interactive', order: 2 },
        { moduleId: module.id, title: `Lesson 3 for Module ${i}`, content: 'Content 3', type: 'quiz', order: 3 },
      ]
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
