import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ScoreBreakdown {
  correctConceptUsage: number;
  correctDefense: number;
  timeEfficiency: number;
  consistency: number;
  repeatedMistakes: number;
  total: number;
}

export interface CalculateScoreParams {
  userId: string;
  sessionId: string;
  category: string;
  outcome: 'defended' | 'partially_defended' | 'breached';
  timeTaken: number;
  isConceptCorrect: boolean;
  choice: string;
}

export class ScoreEngine {
  /**
   * Calculates the score based on the formula:
   * Score = CorrectConceptUsage + CorrectDefense + TimeEfficiency + Consistency - RepeatedMistakes
   */
  public async calculateScore(params: CalculateScoreParams): Promise<ScoreBreakdown> {
    const correctConceptUsage = params.isConceptCorrect ? 20 : 0;

    let correctDefense = 0;
    if (params.outcome === 'defended') {
      correctDefense = 30;
    } else if (params.outcome === 'partially_defended') {
      correctDefense = 15;
    } else {
      correctDefense = 0;
    }

    let timeEfficiency = 0;
    if (params.timeTaken < 30) {
      timeEfficiency = 10;
    } else if (params.timeTaken < 60) {
      timeEfficiency = 7;
    } else if (params.timeTaken < 90) {
      timeEfficiency = 4;
    } else {
      timeEfficiency = 0;
    }

    const consistency = await this.getConsistencyBonus(params.userId, params.category);
    const repeatedMistakes = await this.getRepeatedMistakePenalty(params.userId, params.category, params.choice);

    const total = correctConceptUsage + correctDefense + timeEfficiency + consistency - repeatedMistakes;

    return {
      correctConceptUsage,
      correctDefense,
      timeEfficiency,
      consistency,
      repeatedMistakes,
      total: Math.max(0, total) // Prevent negative total score for a single event if preferred, or keep as is.
    };
  }

  /**
   * Consistency: +10 if last 3 attempts correct, +5 if last 2
   */
  public async getConsistencyBonus(userId: string, category: string): Promise<number> {
    // Fetch last 3 attempts for this user and category
    const lastAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        scenario: { category }
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { scenario: true }
    });

    if (lastAttempts.length < 2) return 0;

    const last2Correct = lastAttempts.slice(0, 2).every(a => a.outcome === 'defended');
    const last3Correct = lastAttempts.length === 3 && lastAttempts.every(a => a.outcome === 'defended');

    if (last3Correct) return 10;
    if (last2Correct) return 5;
    return 0;
  }

  /**
   * RepeatedMistakes: -5 per repeated wrong answer in same category
   */
  public async getRepeatedMistakePenalty(userId: string, category: string, choice: string): Promise<number> {
    const wrongAttempts = await prisma.attempt.count({
      where: {
        userId,
        scenario: { category },
        choice: choice,
        outcome: { not: 'defended' }
      }
    });

    // If they made this same wrong choice before, penalty is 5 per previous wrong attempt
    return wrongAttempts * 5;
  }
}

export const scoreEngine = new ScoreEngine();
