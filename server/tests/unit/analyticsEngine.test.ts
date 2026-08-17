import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockSnapshotFindMany: vi.fn(),
  mockSnapshotCreate: vi.fn(),
  mockAttemptFindMany: vi.fn(),
  mockSessionFindUnique: vi.fn(),
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
      findUnique: mocks.mockSessionFindUnique,
    },
    assessmentSnapshot: {
      findMany: mocks.mockSnapshotFindMany,
      create: mocks.mockSnapshotCreate,
    },
    attempt: {
      findMany: mocks.mockAttemptFindMany,
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import { AnalyticsEngine } from '../../src/services/analyticsEngine';

describe('AnalyticsEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults for the collaborators every getAnalyticsSummary() call touches
    // beyond the per-category totals under test in each case.
    mocks.mockSnapshotFindMany.mockResolvedValue([]);
    mocks.mockAttemptFindMany.mockResolvedValue([]);
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
      expect(summary.accuracyChangeVsLastWeek).toBeNull();
      expect(summary.responseTimeStats).toBeNull();
    });

    it('accuracyChangeVsLastWeek is null when there is no snapshot history at all', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);
      mocks.mockSnapshotFindMany.mockResolvedValue([]);

      const summary = await AnalyticsEngine.getAnalyticsSummary('u1');
      expect(summary.accuracyChangeVsLastWeek).toBeNull();
    });

    it('accuracyChangeVsLastWeek compares this week vs. the prior week', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);
      // First call inside getAnalyticsSummary is "this week", second is "last week".
      mocks.mockSnapshotFindMany
        .mockResolvedValueOnce([{ accuracy: 90 }, { accuracy: 70 }]) // this week avg = 80
        .mockResolvedValueOnce([{ accuracy: 60 }]); // last week avg = 60

      const summary = await AnalyticsEngine.getAnalyticsSummary('u1');
      expect(summary.accuracyChangeVsLastWeek).toBe(20);
    });

    it('responseTimeStats derives fastest/median/slowest from recent attempts', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);
      mocks.mockAttemptFindMany.mockResolvedValue([
        { timeTaken: 30 }, { timeTaken: 10 }, { timeTaken: 20 },
      ]);

      const summary = await AnalyticsEngine.getAnalyticsSummary('u1');
      expect(summary.responseTimeStats).toEqual({ fastest: 10, median: 20, slowest: 30 });
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
    it('maps AssessmentSnapshot rows to {date, accuracy, responseTime} points, oldest first', async () => {
      mocks.mockSnapshotFindMany.mockResolvedValue([
        { completedAt: new Date('2026-08-01T00:00:00Z'), accuracy: 75.4, averageTime: 22.6 },
        { completedAt: new Date('2026-08-03T00:00:00Z'), accuracy: 88.0, averageTime: 15.2 },
      ]);

      const result = await AnalyticsEngine.getPerformanceTrends('u1');

      expect(mocks.mockSnapshotFindMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { completedAt: 'asc' },
        take: 10,
      });
      expect(result).toEqual([
        { date: '2026-08-01', accuracy: 75, responseTime: 23 },
        { date: '2026-08-03', accuracy: 88, responseTime: 15 },
      ]);
    });

    it('returns an empty array when the user has no completed assessments yet', async () => {
      mocks.mockSnapshotFindMany.mockResolvedValue([]);
      const result = await AnalyticsEngine.getPerformanceTrends('u1');
      expect(result).toEqual([]);
    });
  });

  describe('recordAssessmentCompletion', () => {
    it('does nothing if the session cannot be found', async () => {
      mocks.mockSessionFindUnique.mockResolvedValue(null);

      await AnalyticsEngine.recordAssessmentCompletion('missing-session');

      expect(mocks.mockSnapshotCreate).not.toHaveBeenCalled();
    });
  });
});
