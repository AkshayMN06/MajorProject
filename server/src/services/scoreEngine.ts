import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ScoreBreakdown {
  correctChoice: number;
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

type Role = 'attacker' | 'defender';

export class ScoreEngine {
  /**
   * Score = CorrectChoice + TimeEfficiency + Consistency - RepeatedMistakes
   */
  public async calculateDefenderScore(params: CalculateScoreParams): Promise<ScoreBreakdown> {
    let correctChoice = 0;
    if (params.outcome === 'defended') correctChoice = 30;
    else if (params.outcome === 'partially_defended') correctChoice = 25;
    return this.finalize(params, 'defender', correctChoice);
  }

  public async calculateAttackerScore(params: CalculateScoreParams): Promise<ScoreBreakdown> {
    let correctChoice = 5; // still a plausible attempt even if defended
    if (params.outcome === 'breached') correctChoice = 30;
    else if (params.outcome === 'partially_defended') correctChoice = 25;
    return this.finalize(params, 'attacker', correctChoice);
  }

  private async finalize(params: CalculateScoreParams, role: Role, correctChoice: number): Promise<ScoreBreakdown> {
    let timeEfficiency = 0;
    if (params.timeTaken < 30) timeEfficiency = 10;
    else if (params.timeTaken < 60) timeEfficiency = 7;
    else if (params.timeTaken < 90) timeEfficiency = 4;

    const consistency = await this.getConsistencyBonus(params.userId, params.category, role);
    const repeatedMistakes = await this.getRepeatedMistakePenalty(params.userId, params.category, params.choice, role);

    const total = correctChoice + timeEfficiency + consistency - repeatedMistakes;

    return {
      correctChoice,
      timeEfficiency,
      consistency,
      repeatedMistakes,
      total: Math.max(0, total),
    };
  }

  /**
   * Consistency: +10 if last 3 attempts in this category succeeded, +5 if last 2.
   * "Succeeded" means outcome === 'defended' for a defender, 'breached' for an attacker.
   */
  public async getConsistencyBonus(userId: string, category: string, role: Role = 'defender'): Promise<number> {
    const successOutcome = role === 'defender' ? 'defended' : 'breached';
    const lastAttempts = await prisma.attempt.findMany({
      where: { userId, role, scenario: { category } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { scenario: true },
    });

    if (lastAttempts.length < 2) return 0;

    const last2Correct = lastAttempts.slice(0, 2).every((a) => a.outcome === successOutcome);
    const last3Correct = lastAttempts.length === 3 && lastAttempts.every((a) => a.outcome === successOutcome);

    if (last3Correct) return 10;
    if (last2Correct) return 5;
    return 0;
  }

  /**
   * RepeatedMistakes: -5 per previous attempt where the same choice, in the
   * same category, failed for this role.
   */
  public async getRepeatedMistakePenalty(userId: string, category: string, choice: string, role: Role = 'defender'): Promise<number> {
    const wrongAttempts = await prisma.attempt.count({
      where: {
        userId,
        role,
        scenario: { category },
        choice,
        outcome: role === 'defender' ? { not: 'defended' } : 'defended',
      },
    });

    return wrongAttempts * 5;
  }
}

export const scoreEngine = new ScoreEngine();
