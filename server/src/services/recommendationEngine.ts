import { PrismaClient } from '@prisma/client';
import { AnalyticsEngine } from './analyticsEngine';

const prisma = new PrismaClient();

export class RecommendationEngine {
  static async generateRecommendations(userId: string) {
    const categories = await AnalyticsEngine.getCategoryAccuracy(userId);
    const existingRecs = await prisma.recommendation.findMany({ where: { userId, isCompleted: false } });

    // Module.category matches Scenario.category (see moduleData.ts) — one
    // lookup up front so every 'module'/'topic' recommendation below can
    // link straight to the matching curriculum module instead of leaving
    // moduleId unset.
    const modules = await prisma.module.findMany({ select: { id: true, category: true } });
    const moduleIdByCategory = new Map(modules.map((m) => [m.category, m.id]));

    const newRecs = [];

    // IF accuracy < 50% in a category -> Recommend beginner module (priority 1)
    // IF accuracy < 70% in a category -> Recommend intermediate module (priority 2)
    for (const cat of categories) {
      const moduleId = moduleIdByCategory.get(cat.category);
      if (cat.accuracy < 50) {
        newRecs.push({
          userId,
          type: 'module',
          title: `Beginner Module: ${cat.category}`,
          description: `Your accuracy in ${cat.category} is low. Review the basics.`,
          moduleId,
          priority: 1,
          isCompleted: false,
        });
      } else if (cat.accuracy < 70) {
        newRecs.push({
          userId,
          type: 'module',
          title: `Intermediate Module: ${cat.category}`,
          description: `You can improve your skills in ${cat.category}. Try intermediate topics.`,
          moduleId,
          priority: 2,
          isCompleted: false,
        });
      }

      // IF struggles with specific topics (mock implementations)
      if (cat.category === 'Web Security' && cat.accuracy < 50) {
        newRecs.push({
          userId, type: 'module', title: 'Secure Coding Module', description: 'Focus on preventing Injection vulnerabilities.', moduleId, priority: 1, isCompleted: false
        });
      }
      if (cat.category === 'Social Engineering' && cat.accuracy < 60) {
        newRecs.push({
          userId, type: 'module', title: 'Authentication Module', description: 'Improve your resilience against phishing.', moduleId, priority: 1, isCompleted: false
        });
      }
      if (cat.category === 'Network Security' && cat.accuracy < 50) {
        newRecs.push({
          userId, type: 'module', title: 'Network Security Fundamentals', description: 'Review network defenses.', moduleId, priority: 1, isCompleted: false
        });
      }
    }

    const summary = await AnalyticsEngine.getAnalyticsSummary(userId);
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
    const allCategories = ['Network Security', 'Web Security', 'Cryptography', 'Social Engineering'];
    const attemptedCats = categories.map(c => c.category);
    for (const cat of allCategories) {
      if (!attemptedCats.includes(cat)) {
        newRecs.push({
          userId,
          type: 'topic',
          title: `Intro to ${cat}`,
          description: `Try scenarios in ${cat} to test your knowledge.`,
          moduleId: moduleIdByCategory.get(cat),
          priority: 3,
          isCompleted: false,
        });
      }
    }

    // Save non-duplicate recommendations
    for (const rec of newRecs) {
      const exists = existingRecs.find(r => r.title === rec.title);
      if (!exists) {
        await prisma.recommendation.create({ data: rec });
      }
    }
  }

  static async getUserRecommendations(userId: string) {
    return prisma.recommendation.findMany({
      where: { userId, isCompleted: false },
      orderBy: { priority: 'asc' }
    });
  }

  static async markCompleted(recommendationId: string) {
    return prisma.recommendation.update({
      where: { id: recommendationId },
      data: { isCompleted: true },
    });
  }
}
