import { Prisma, PrismaClient } from '@prisma/client';
import { AnalyticsEngine } from './analyticsEngine';

const prisma = new PrismaClient();

export class RecommendationEngine {
  static async generateRecommendations(userId: string, db: Prisma.TransactionClient = prisma) {
    const categories = await AnalyticsEngine.getCategoryAccuracy(userId, db);
    const existingRecs = await db.recommendation.findMany({ where: { userId, isCompleted: false } });

    const modules = await db.module.findMany({
      // Only modules students can open; drafts/archived would be dead links.
      where: { status: 'PUBLISHED' },
      select: { id: true, category: true, difficulty: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    const moduleIdFor = (category: string, difficulty: 'Easy' | 'Medium') => {
      const matchingModule = modules.find((module) => module.category === category && module.difficulty === difficulty);
      // Older databases can still have only a Medium module per category.
      return matchingModule?.id ?? (difficulty === 'Easy'
        ? modules.find((module) => module.category === category && module.difficulty === 'Medium')?.id
        : undefined);
    };

    const newRecs = [];

    // IF accuracy < 50% in a category -> Recommend beginner module (priority 1)
    // IF accuracy < 70% in a category -> Recommend intermediate module (priority 2)
    for (const cat of categories) {
      const beginnerModuleId = moduleIdFor(cat.category, 'Easy');
      const intermediateModuleId = moduleIdFor(cat.category, 'Medium');
      if (cat.accuracy < 50) {
        newRecs.push({
          userId,
          type: 'module',
          title: `Beginner Module: ${cat.category}`,
          description: `Your accuracy in ${cat.category} is low. Review the basics.`,
          moduleId: beginnerModuleId,
          priority: 1,
          isCompleted: false,
        });
      } else if (cat.accuracy < 70) {
        newRecs.push({
          userId,
          type: 'module',
          title: `Intermediate Module: ${cat.category}`,
          description: `You can improve your skills in ${cat.category}. Try intermediate topics.`,
          moduleId: intermediateModuleId,
          priority: 2,
          isCompleted: false,
        });
      }

      // IF struggles with specific topics (mock implementations)
      if (cat.category === 'Web Security' && cat.accuracy < 50) {
        newRecs.push({
          userId, type: 'module', title: 'Secure Coding Module', description: 'Focus on preventing Injection vulnerabilities.', moduleId: beginnerModuleId, priority: 1, isCompleted: false
        });
      }
      if (cat.category === 'Social Engineering' && cat.accuracy < 60) {
        newRecs.push({
          userId, type: 'module', title: 'Authentication Module', description: 'Improve your resilience against phishing.', moduleId: beginnerModuleId, priority: 1, isCompleted: false
        });
      }
      if (cat.category === 'Network Security' && cat.accuracy < 50) {
        newRecs.push({
          userId, type: 'module', title: 'Network Security Fundamentals', description: 'Review network defenses.', moduleId: beginnerModuleId, priority: 1, isCompleted: false
        });
      }
    }

    const summary = await AnalyticsEngine.getAnalyticsSummary(userId, db);
    // IF response time > 60s average -> Recommend timed practice drills
    if (summary.averageResponseTime > 60) {
      newRecs.push({
        userId,
        type: 'practice',
        title: 'Timed Practice Drills',
        description: 'Your average response time is high. Practice making quicker decisions.',
        priority: 2,
        isCompleted: false,
      });
    }

    // IF no attempts in a category -> Recommend introductory scenario (priority 3)
    const allCategories = ['Network Security', 'Web Security', 'Cryptography', 'Social Engineering', 'System Security'];
    const attemptedCats = new Set(categories.map(c => c.category));
    for (const cat of allCategories) {
      if (!attemptedCats.has(cat)) {
        newRecs.push({
          userId,
          type: 'topic',
          title: `Intro to ${cat}`,
          description: `Try scenarios in ${cat} to test your knowledge.`,
          moduleId: moduleIdFor(cat, 'Easy'),
          priority: 3,
          isCompleted: false,
        });
      }
    }

    // Update old links without creating duplicate recommendations.
    for (const rec of newRecs) {
      const existing = existingRecs.find((recommendation) => recommendation.title === rec.title);
      if (!existing) {
        await db.recommendation.create({ data: rec });
      } else if (rec.moduleId && rec.moduleId !== existing.moduleId) {
        await db.recommendation.updateMany({
          where: { id: existing.id, userId, isCompleted: false, moduleId: existing.moduleId },
          data: { moduleId: rec.moduleId },
        });
      }
    }
  }

  static async getUserRecommendations(userId: string) {
    return prisma.recommendation.findMany({
      where: { userId, isCompleted: false },
      orderBy: { priority: 'asc' }
    });
  }

  static async markCompleted(recommendationId: string, userId: string) {
    try {
      return await prisma.recommendation.update({
        where: { id: recommendationId, userId },
        data: { isCompleted: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }
}
