import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockGetCategoryAccuracy: vi.fn(),
  mockGetAnalyticsSummary: vi.fn(),
}));

vi.mock('@prisma/client', () => {
  const mockPrisma = {
    recommendation: {
      findMany: mocks.mockFindMany,
      create: mocks.mockCreate,
      update: mocks.mockUpdate,
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

vi.mock('../../src/services/analyticsEngine', () => ({
  AnalyticsEngine: {
    getCategoryAccuracy: mocks.mockGetCategoryAccuracy,
    getAnalyticsSummary: mocks.mockGetAnalyticsSummary,
  }
}));

import { RecommendationEngine } from '../../src/services/recommendationEngine';

describe('RecommendationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateRecommendations', () => {
    it('creates beginner module recommendation when accuracy < 50', async () => {
      mocks.mockGetCategoryAccuracy.mockResolvedValue([{ category: 'Cryptography', accuracy: 40 }]);
      mocks.mockGetAnalyticsSummary.mockResolvedValue({ averageResponseTime: 30 });
      mocks.mockFindMany.mockResolvedValue([]);

      await RecommendationEngine.generateRecommendations('u1');

      expect(mocks.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Beginner Module: Cryptography',
          priority: 1
        })
      }));
    });

    it('creates intermediate recommendation when accuracy between 50-70', async () => {
      mocks.mockGetCategoryAccuracy.mockResolvedValue([{ category: 'Cryptography', accuracy: 60 }]);
      mocks.mockGetAnalyticsSummary.mockResolvedValue({ averageResponseTime: 30 });
      mocks.mockFindMany.mockResolvedValue([]);

      await RecommendationEngine.generateRecommendations('u1');

      expect(mocks.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Intermediate Module: Cryptography',
          priority: 2
        })
      }));
    });

    it('no recommendation for that category when accuracy >= 70', async () => {
      mocks.mockGetCategoryAccuracy.mockResolvedValue([{ category: 'Cryptography', accuracy: 75 }]);
      mocks.mockGetAnalyticsSummary.mockResolvedValue({ averageResponseTime: 30 });
      mocks.mockFindMany.mockResolvedValue([]);

      await RecommendationEngine.generateRecommendations('u1');

      const calls = mocks.mockCreate.mock.calls;
      const cryptoModules = calls.filter(call => call[0].data.title.includes('Module: Cryptography'));
      expect(cryptoModules.length).toBe(0);
    });

    it('adds Authentication Module recommendation when Social Engineering accuracy < 60', async () => {
      mocks.mockGetCategoryAccuracy.mockResolvedValue([{ category: 'Social Engineering', accuracy: 55 }]);
      mocks.mockGetAnalyticsSummary.mockResolvedValue({ averageResponseTime: 30 });
      mocks.mockFindMany.mockResolvedValue([]);

      await RecommendationEngine.generateRecommendations('u1');

      expect(mocks.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Authentication Module',
          priority: 1
        })
      }));
    });

    it('adds Network Security Fundamentals recommendation when Network Security accuracy < 50', async () => {
      mocks.mockGetCategoryAccuracy.mockResolvedValue([{ category: 'Network Security', accuracy: 40 }]);
      mocks.mockGetAnalyticsSummary.mockResolvedValue({ averageResponseTime: 30 });
      mocks.mockFindMany.mockResolvedValue([]);

      await RecommendationEngine.generateRecommendations('u1');

      expect(mocks.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Network Security Fundamentals',
          priority: 1
        })
      }));
    });

    it('adds Timed Practice Drills recommendation when averageResponseTime > 60', async () => {
      mocks.mockGetCategoryAccuracy.mockResolvedValue([{ category: 'Cryptography', accuracy: 80 }]);
      mocks.mockGetAnalyticsSummary.mockResolvedValue({ averageResponseTime: 65 });
      mocks.mockFindMany.mockResolvedValue([]);

      await RecommendationEngine.generateRecommendations('u1');

      expect(mocks.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Timed Practice Drills',
          priority: 2
        })
      }));
    });

    it('adds Intro recommendation (priority 3) when a category has no attempts', async () => {
      mocks.mockGetCategoryAccuracy.mockResolvedValue([]);
      mocks.mockGetAnalyticsSummary.mockResolvedValue({ averageResponseTime: 30 });
      mocks.mockFindMany.mockResolvedValue([]);

      await RecommendationEngine.generateRecommendations('u1');

      expect(mocks.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Intro to Network Security',
          priority: 3
        })
      }));
      expect(mocks.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Intro to Web Security',
          priority: 3
        })
      }));
    });

    it('Does not create duplicate recommendations (checks existing recs)', async () => {
      mocks.mockGetCategoryAccuracy.mockResolvedValue([{ category: 'Cryptography', accuracy: 40 }]);
      mocks.mockGetAnalyticsSummary.mockResolvedValue({ averageResponseTime: 30 });
      mocks.mockFindMany.mockResolvedValue([{ title: 'Beginner Module: Cryptography' }]);

      await RecommendationEngine.generateRecommendations('u1');

      const calls = mocks.mockCreate.mock.calls;
      const duplicateCreates = calls.filter(call => call[0].data.title === 'Beginner Module: Cryptography');
      expect(duplicateCreates.length).toBe(0);
    });
  });

  describe('markCompleted', () => {
    it('calls prisma.recommendation.update with isCompleted: true', async () => {
      mocks.mockUpdate.mockResolvedValue({});
      await RecommendationEngine.markCompleted('r1');

      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { isCompleted: true }
      });
    });
  });

  describe('getUserRecommendations', () => {
    it('returns sorted by priority asc', async () => {
      const mockResult = [{ title: 'A' }, { title: 'B' }];
      mocks.mockFindMany.mockResolvedValue(mockResult);

      const res = await RecommendationEngine.getUserRecommendations('u1');
      expect(res).toBe(mockResult);
      expect(mocks.mockFindMany).toHaveBeenCalledWith({
        where: { userId: 'u1', isCompleted: false },
        orderBy: { priority: 'asc' }
      });
    });
  });
});
