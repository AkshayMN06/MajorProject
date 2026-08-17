// Loads active questions from prisma/quizQuestionData.ts (see that file's
// header for how it combines the CSV-derived definition pool with the
// hand-authored application questions) into the Question table. Upserts by
// `questionId` so re-running is safe and idempotent.
import { PrismaClient } from '@prisma/client';
import { QUIZ_QUESTIONS } from './quizQuestionData';

const prisma = new PrismaClient();

async function main() {
  const active = QUIZ_QUESTIONS.filter((q) => q.isActive);
  console.log(`Importing ${active.length} active questions (of ${QUIZ_QUESTIONS.length} total)...`);

  for (const q of active) {
    await prisma.question.upsert({
      where: { questionId: q.questionId },
      update: {
        question: q.question,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        topic: q.topic,
        moduleTag: q.moduleTag,
        topicTag: q.topicTag,
        difficulty: q.difficulty,
        testForm: q.testForm,
        explanation: q.explanation,
        isActive: q.isActive,
      },
      create: {
        questionId: q.questionId,
        question: q.question,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        topic: q.topic,
        moduleTag: q.moduleTag,
        topicTag: q.topicTag,
        difficulty: q.difficulty,
        testForm: q.testForm,
        explanation: q.explanation,
        isActive: q.isActive,
      },
    });
  }

  const byForm = await prisma.question.groupBy({ by: ['testForm'], _count: true, where: { isActive: true } });
  console.log('Import complete.', byForm.map((f) => `${f.testForm}: ${f._count}`).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
