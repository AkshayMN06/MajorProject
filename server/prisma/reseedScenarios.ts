import { PrismaClient } from '@prisma/client';
import { SCENARIOS } from './scenarioData';

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

    const rulesData = [];
    for (const attack of sData.attackOptions) {
      for (const defense of sData.defenseOptions) {
        let outcome = 'breached';
        let explanation = 'The defense was completely ineffective against this attack.';
        let scoreModifier = -10;

        if (attack.id === 'a1' && defense.id === 'd1') {
          outcome = 'defended';
          explanation = 'The primary defense perfectly countered the primary attack method.';
          scoreModifier = 20;
        } else if (attack.id === 'a2' && defense.id === 'd2') {
          outcome = 'defended';
          explanation = 'The specific technical control successfully blocked the exploit attempt.';
          scoreModifier = 20;
        } else if (attack.id === 'a3' && defense.id === 'd3') {
          outcome = 'defended';
          explanation = 'Properly configured security settings neutralized the threat.';
          scoreModifier = 20;
        } else if (attack.category === defense.category) {
          outcome = 'partially_defended';
          explanation = 'The defense belonged to the right category but was not specific enough to fully stop the attack, mitigating some damage.';
          scoreModifier = 5;
        }

        rulesData.push({
          scenarioId: scenario.id,
          attackType: attack.id,
          defenseType: defense.id,
          outcome,
          explanation,
          scoreModifier,
        });
      }
    }

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
