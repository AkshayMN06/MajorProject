import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock('@prisma/client', () => {
  const mockPrisma = {
    attempt: {
      findMany: mocks.mockFindMany,
      count: mocks.mockCount,
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import { scoreEngine } from '../../src/services/scoreEngine';

describe('ScoreEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateScore', () => {
    it('outcome: defended, timeTaken: 20, isConceptCorrect: true', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);

      const result = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'defended',
        timeTaken: 20, isConceptCorrect: true, choice: 'c1'
      });
      
      expect(result.correctConceptUsage).toBe(20);
      expect(result.correctDefense).toBe(30);
      expect(result.timeEfficiency).toBe(10);
      expect(result.total).toBe(60);
    });

    it('outcome: partially_defended, timeTaken: 45', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);

      const result = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'partially_defended',
        timeTaken: 45, isConceptCorrect: false, choice: 'c1'
      });
      
      expect(result.correctDefense).toBe(15);
      expect(result.timeEfficiency).toBe(7);
    });

    it('outcome: breached, timeTaken: 100', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);

      const result = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'breached',
        timeTaken: 100, isConceptCorrect: false, choice: 'c1'
      });
      
      expect(result.correctDefense).toBe(0);
      expect(result.timeEfficiency).toBe(0);
    });

    it('timeTaken: 29 -> timeEfficiency=10', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);
      const res = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'breached', timeTaken: 29, isConceptCorrect: false, choice: 'c1'
      });
      expect(res.timeEfficiency).toBe(10);
    });

    it('timeTaken: 59 -> timeEfficiency=7', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);
      const res = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'breached', timeTaken: 59, isConceptCorrect: false, choice: 'c1'
      });
      expect(res.timeEfficiency).toBe(7);
    });

    it('timeTaken: 89 -> timeEfficiency=4', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);
      const res = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'breached', timeTaken: 89, isConceptCorrect: false, choice: 'c1'
      });
      expect(res.timeEfficiency).toBe(4);
    });

    it('timeTaken: 90 -> timeEfficiency=0', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(0);
      const res = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'breached', timeTaken: 90, isConceptCorrect: false, choice: 'c1'
      });
      expect(res.timeEfficiency).toBe(0);
    });

    it('When Prisma returns 3 correct defended attempts -> consistency=10', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { outcome: 'defended' }, { outcome: 'defended' }, { outcome: 'defended' }
      ]);
      mocks.mockCount.mockResolvedValue(0);
      const res = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'defended', timeTaken: 20, isConceptCorrect: true, choice: 'c1'
      });
      expect(res.consistency).toBe(10);
    });

    it('When Prisma returns 2 correct + 1 wrong -> consistency=5', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { outcome: 'defended' }, { outcome: 'defended' }, { outcome: 'breached' }
      ]);
      mocks.mockCount.mockResolvedValue(0);
      const res = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'defended', timeTaken: 20, isConceptCorrect: true, choice: 'c1'
      });
      expect(res.consistency).toBe(5);
    });

    it('When Prisma returns 1 attempt -> consistency=0', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { outcome: 'defended' }
      ]);
      mocks.mockCount.mockResolvedValue(0);
      const res = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'defended', timeTaken: 20, isConceptCorrect: true, choice: 'c1'
      });
      expect(res.consistency).toBe(0);
    });

    it('Repeated mistake: Prisma count returns 2 -> penalty=10', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(2);
      const res = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'breached', timeTaken: 100, isConceptCorrect: false, choice: 'c1'
      });
      expect(res.repeatedMistakes).toBe(10);
    });

    it('Total score is never negative (min 0)', async () => {
      mocks.mockFindMany.mockResolvedValue([]);
      mocks.mockCount.mockResolvedValue(10); // 50 penalty
      const res = await scoreEngine.calculateScore({
        userId: 'u1', sessionId: 's1', category: 'cat', outcome: 'breached', timeTaken: 100, isConceptCorrect: false, choice: 'c1'
      });
      expect(res.total).toBe(0); // 0 + 0 + 0 + 0 - 50 -> clamped to 0
    });
  });

  describe('getConsistencyBonus', () => {
    it('returns 10 for 3 defended attempts', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { outcome: 'defended' }, { outcome: 'defended' }, { outcome: 'defended' }
      ]);
      const res = await scoreEngine.getConsistencyBonus('u1', 'cat');
      expect(res).toBe(10);
    });
    
    it('returns 5 for 2 defended attempts out of 3', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { outcome: 'defended' }, { outcome: 'defended' }, { outcome: 'breached' }
      ]);
      const res = await scoreEngine.getConsistencyBonus('u1', 'cat');
      expect(res).toBe(5);
    });

    it('returns 0 if not enough correct', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { outcome: 'defended' }, { outcome: 'breached' }, { outcome: 'defended' }
      ]);
      const res = await scoreEngine.getConsistencyBonus('u1', 'cat');
      expect(res).toBe(0);
    });
  });

  describe('getRepeatedMistakePenalty', () => {
    it('returns count * 5', async () => {
      mocks.mockCount.mockResolvedValue(3);
      const res = await scoreEngine.getRepeatedMistakePenalty('u1', 'cat', 'choice');
      expect(res).toBe(15);
    });
  });
});
