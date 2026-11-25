// Regenerates the predefined curriculum (modules with origin = BUILTIN)
// from moduleData.ts. Wipes LessonProgress for those predefined lessons only
// (old lesson ids won't exist after this runs). Teacher/admin-authored
// modules, their files and learners' progress on them are left untouched,
// as are scenarios, sessions and all gameplay/assessment history.
import { PrismaClient } from '@prisma/client';
import { MODULES } from './moduleData';

const prisma = new PrismaClient();

async function main() {
  console.log('Reseeding modules/lessons...');

  // Keyed on origin, not createdById: an authored module whose author was
  // deleted has a null creator but must never be treated as curriculum.
  const builtin = { module: { origin: 'BUILTIN' } };
  await prisma.lessonProgress.deleteMany({ where: { lesson: builtin } });
  await prisma.lesson.deleteMany({ where: builtin });
  await prisma.module.deleteMany({ where: { origin: 'BUILTIN' } });

  let totalLessons = 0;
  for (const m of MODULES) {
    const created = await prisma.module.create({
      data: {
        name: m.name,
        activeTitleKey: m.name.replace(/^ +| +$/g, '').replace(/[A-Z]/g, (c) => c.toLowerCase()), // = SQLite lower(trim(name)), as in module management
        description: m.description,
        category: m.category,
        difficulty: m.difficulty,
        duration: m.duration,
        type: m.type,
        content: {},
        order: m.order,
      },
    });

    await prisma.lesson.createMany({
      data: m.lessons.map((l) => ({
        moduleId: created.id,
        title: l.title,
        content: l.content,
        type: l.type,
        order: l.order,
      })),
    });
    totalLessons += m.lessons.length;
  }

  console.log(`Done. ${MODULES.length} modules, ${totalLessons} lessons written.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
