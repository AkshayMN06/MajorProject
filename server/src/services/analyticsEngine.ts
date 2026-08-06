import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AnalyticsEngine {
  static async updateAnalytics(userId: string, category: string, isCorrect: boolean, timeTaken: number) {
    const existing = await prisma.analytics.findFirst({
      where: { userId, category },
    });

    if (existing) {
      const totalAttempts = existing.totalAttempts + 1;
      const correctAttempts = existing.correctAttempts + (isCorrect ? 1 : 0);
      const accuracy = (correctAttempts / totalAttempts) * 100;
      const averageTime = ((existing.averageTime * existing.totalAttempts) + timeTaken) / totalAttempts;

      return prisma.analytics.update({
        where: { id: existing.id },
        data: {
          totalAttempts,
          correctAttempts,
          accuracy,
          averageTime,
          lastUpdated: new Date(),
        },
      });
    } else {
      return prisma.analytics.create({
        data: {
          userId,
          category,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
          accuracy: isCorrect ? 100 : 0,
          averageTime: timeTaken,
          lastUpdated: new Date(),
        },
      });
    }
  }

  static async getUserAnalytics(userId: string) {
    return prisma.analytics.findMany({
      where: { userId },
    });
  }

  static async getAnalyticsSummary(userId: string) {
    const analytics = await this.getUserAnalytics(userId);
    const sessions = await prisma.session.count({
      where: {
        OR: [
          { attackerId: userId },
          { defenderId: userId },
        ],
      },
    });

    let totalAttempts = 0;
    let correctAttempts = 0;
    let totalTime = 0;

    analytics.forEach(a => {
      totalAttempts += a.totalAttempts;
      correctAttempts += a.correctAttempts;
      totalTime += (a.averageTime * a.totalAttempts);
    });

    return {
      totalSessions: sessions,
      scenariosAttempted: totalAttempts,
      correctDecisions: correctAttempts,
      incorrectDecisions: totalAttempts - correctAttempts,
      averageScore: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
      averageResponseTime: totalAttempts > 0 ? totalTime / totalAttempts : 0,
      weekOverWeek: {
        sessions: 0,
        scenarios: 0,
        correct: 0,
        incorrect: 0,
      } // simplified placeholder
    };
  }

  static async getPerformanceTrends(userId: string, days = 7) {
    // simplified trend generation for demo
    const trends = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        accuracy: Math.random() * 40 + 60, // random data
        responseTime: Math.random() * 30 + 10,
      });
    }
    return trends;
  }

  static async getCategoryAccuracy(userId: string) {
    const analytics = await this.getUserAnalytics(userId);
    return analytics.map(a => ({
      category: a.category,
      accuracy: a.accuracy,
    }));
  }
}
