import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock('@prisma/client', () => {
  const mockPrisma = {
    analytics: {
      findFirst: mocks.mockFindFirst,
      create: mocks.mockCreate,
      update: mocks.mockUpdate,
      findMany: mocks.mockFindMany,
    },
    session: {
      count: mocks.mockCount,
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import { AnalyticsEngine } from '../../src/services/analyticsEngine';

describe('AnalyticsEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateAnalytics', () => {
    it('when no existing record -> creates new analytics entry with correct values', async () => {
      mocks.mockFindFirst.mockResolvedValue(null);
      mocks.mockCreate.mockResolvedValue({ id: 'a1', accuracy: 100 });

      await AnalyticsEngine.updateAnalytics('u1', 'cat1', true, 20);

      expect(mocks.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          category: 'cat1',
          totalAttempts: 1,
          correctAttempts: 1,
          accuracy: 100,
          averageTime: 20
        })
      }));
    });

    it('when existing record -> updates with correctly computed averages and accuracy', async () => {
      mocks.mockFindFirst.mockResolvedValue({
        id: 'a1',
        totalAttempts: 1,
        correctAttempts: 1,
        accuracy: 100,
        averageTime: 20
      });
      mocks.mockUpdate.mockResolvedValue({});

      await AnalyticsEngine.updateAnalytics('u1', 'cat1', false, 40);

      expect(mocks.mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({
          totalAttempts: 2,
          correctAttempts: 1,
          accuracy: 50,
          averageTime: 30
        })
      }));
    });
  });

  describe('getAnalyticsSummary', () => {
    it('with analytics data -> correctly sums totalAttempts, correctAttempts, and computes averageScore', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { totalAttempts: 10, correctAttempts: 8, averageTime: 20 },
        { totalAttempts: 10, correctAttempts: 2, averageTime: 40 }
      ]);
      mocks.mockCount.mockResolvedValue(5);

      const summary = await AnalyticsEngine.getAnalyticsSummary('u1');

      expect(summary.totalSessions).toBe(5);
      expect(summary.scenariosAttempted).toBe(20);
      expect(summary.correctDecisions).toBe(10);
      expect(summary.incorrectDecisions).toBe(10);
      expect(summary.averageScore).toBe(50);
      expect(summary.averageResponseTime).toBe(30);
    });

    it('with no data -> returns zeroes without division errors', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);

      const summary = await AnalyticsEngine.getAnalyticsSummary('u1');

      expect(summary.totalSessions).toBe(0);
      expect(summary.scenariosAttempted).toBe(0);
      expect(summary.correctDecisions).toBe(0);
      expect(summary.incorrectDecisions).toBe(0);
      expect(summary.averageScore).toBe(0);
      expect(summary.averageResponseTime).toBe(0);
    });
  });

  describe('getCategoryAccuracy', () => {
    it('maps analytics to category+accuracy pairs', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { category: 'Network', accuracy: 80 },
        { category: 'Social', accuracy: 50 }
      ]);

      const result = await AnalyticsEngine.getCategoryAccuracy('u1');
      expect(result).toEqual([
        { category: 'Network', accuracy: 80 },
        { category: 'Social', accuracy: 50 }
      ]);
    });
  });

  describe('getPerformanceTrends', () => {
    it('returns 7 data points with date, accuracy, responseTime', async () => {
      const result = await AnalyticsEngine.getPerformanceTrends('u1', 7);
      expect(result).toHaveLength(7);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('accuracy');
      expect(result[0]).toHaveProperty('responseTime');
    });
  });
});
