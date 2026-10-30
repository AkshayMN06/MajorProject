// Regenerates the `modules`/`lessons` tables from moduleData.ts's real
// curriculum content, replacing the placeholder "Cyber Security Module N"
// seed data. Wipes LessonProgress too (it references lessonId, and old
// lesson ids won't exist after this runs) — never touches scenarios,
// sessions, or any gameplay/assessment history.
import { PrismaClient } from '@prisma/client';
import { MODULES } from './moduleData';

const prisma = new PrismaClient();

async function main() {
  console.log('Reseeding modules/lessons...');

  await prisma.lessonProgress.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();

  let totalLessons = 0;
  for (const m of MODULES) {
    const created = await prisma.module.create({
      data: {
        name: m.name,
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
