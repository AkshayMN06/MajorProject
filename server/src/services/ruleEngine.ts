import { PrismaClient } from '@prisma/client';
import { scoreEngine } from './scoreEngine';
import { Outcome, EvaluationResult } from '../../../shared/types'; // Using relative path for types

const prisma = new PrismaClient();

export class RuleEngine {
  /**
   * Main method to evaluate a turn in the scenario.
   */
  public async evaluate(
    sessionId: string,
    scenarioId: string,
    attackerChoice: string,
    defenderChoice: string,
    attackParams: Record<string, unknown>,
    defenseParams: Record<string, unknown>,
    timeTaken: number
  ): Promise<EvaluationResult> {
    
    // 1. validateScenario
    const scenario = await this.validateScenario(scenarioId);

    // 2. globalRuleChecks
    await this.globalRuleChecks(sessionId);

    // 3. evaluateDefenseRules & 4. applyAttackModifiers & 5. resolveOutcome
    const { outcome, explanation } = await this.resolveOutcome(scenarioId, attackerChoice, defenderChoice, attackParams, defenseParams);

    // Fetch user IDs for scoring (assuming we have session details)
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error('Session not found');

    // 6. calculateScore
    // For defender
    const defenderScoreBreakdown = await scoreEngine.calculateScore({
      userId: session.defenderId,
      sessionId,
      category: scenario.category,
      outcome: outcome as any,
      timeTaken,
      isConceptCorrect: outcome === 'defended' || outcome === 'partially_defended',
      choice: defenderChoice
    });

    // 7. generateExplanation (Already partially generated from resolveOutcome based on DB rule)
    const finalExplanation = this.generateExplanation(outcome as Outcome, explanation);

    // 8. saveEvent (invoke Event Logger - saving to DB here)
    const turnId = await prisma.event.count({ where: { sessionId } }) + 1;
    await prisma.event.create({
      data: {
        turnId,
        sessionId,
        scenarioId,
        attackerChoice,
        defenderChoice,
        resolvedRule: `${attackerChoice}_vs_${defenderChoice}`,
        outcome,
        score: defenderScoreBreakdown.total,
        timeTaken
      }
    });

    // Save attempts
    await prisma.attempt.create({
      data: {
        sessionId,
        scenarioId,
        userId: session.defenderId,
        role: 'defender',
        choice: defenderChoice,
        parameters: defenseParams || {},
        outcome,
        score: defenderScoreBreakdown.total,
        timeTaken,
        explanation: finalExplanation
      }
    });

    // 9. updateAnalytics (mocking analytics update here)
    await this.updateAnalytics(session.defenderId, scenario.category, outcome as Outcome, timeTaken);

    return {
      sessionId,
      scenarioId,
      turnId,
      attackerChoice,
      defenderChoice,
      outcome: outcome as Outcome,
      explanation: finalExplanation,
      scoreBreakdown: defenderScoreBreakdown,
      attackerTotalScore: 0, // Mocked for now, would aggregate
      defenderTotalScore: defenderScoreBreakdown.total // Mocked for now, would aggregate
    };
  }

  private async validateScenario(scenarioId: string) {
    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }
    return scenario;
  }

  private async globalRuleChecks(sessionId: string) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (session.status === 'SESSION_COMPLETE') {
      throw new Error('Session is already complete');
    }
  }

  private async resolveOutcome(
    scenarioId: string, 
    attackerChoice: string, 
    defenderChoice: string,
    attackParams: Record<string, unknown>,
    defenseParams: Record<string, unknown>
  ) {
    const rule = await prisma.rule.findFirst({
      where: {
        scenarioId,
        attackType: attackerChoice,
        defenseType: defenderChoice
      }
    });

    if (rule) {
      return {
        outcome: rule.outcome,
        explanation: rule.explanation
      };
    }

    // Default fallback if no specific rule is found
    return {
      outcome: 'breached',
      explanation: 'The defense provided no protection against this specific attack.'
    };
  }

  private generateExplanation(outcome: Outcome, baseExplanation: string): string {
    // Additional educational context can be appended here
    if (outcome === Outcome.DEFENDED) {
      return `Success! ${baseExplanation}`;
    } else if (outcome === Outcome.PARTIALLY_DEFENDED) {
      return `Partial Success. ${baseExplanation}`;
    } else {
      return `Breach Detected. ${baseExplanation}`;
    }
  }

  private async updateAnalytics(userId: string, category: string, outcome: Outcome, timeTaken: number) {
    const isCorrect = outcome === Outcome.DEFENDED;
    
    let analytics = await prisma.analytics.findFirst({
      where: { userId, category }
    });

    if (!analytics) {
      analytics = await prisma.analytics.create({
        data: {
          userId,
          category,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
          averageTime: timeTaken,
          accuracy: isCorrect ? 100 : 0
        }
      });
    } else {
      const newTotal = analytics.totalAttempts + 1;
      const newCorrect = analytics.correctAttempts + (isCorrect ? 1 : 0);
      const newAvgTime = ((analytics.averageTime * analytics.totalAttempts) + timeTaken) / newTotal;
      const newAccuracy = (newCorrect / newTotal) * 100;

      await prisma.analytics.update({
        where: { id: analytics.id },
        data: {
          totalAttempts: newTotal,
          correctAttempts: newCorrect,
          averageTime: newAvgTime,
          accuracy: newAccuracy
        }
      });
    }
  }
}

export const ruleEngine = new RuleEngine();
