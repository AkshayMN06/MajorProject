import { PrismaClient } from '@prisma/client';
import { scoreEngine, ScoreBreakdown } from './scoreEngine';
import { EventLogger } from './eventLogger';
import { AnalyticsEngine } from './analyticsEngine';
import { Outcome } from '../../../shared/types';

const prisma = new PrismaClient();

export interface EvaluateInput {
  sessionId: string;
  scenarioId: string;
  attackerId: string;
  defenderId: string;
  attackerChoice: string;
  defenderChoice: string;
  attackerTimeTaken: number;
  defenderTimeTaken: number;
}

export interface EvaluateResult {
  sessionId: string;
  scenarioId: string;
  turnId: number;
  outcome: Outcome;
  explanation: string;
  attackerScoreBreakdown: ScoreBreakdown;
  defenderScoreBreakdown: ScoreBreakdown;
}

/**
 * Backend-only deterministic rule engine. Pipeline:
 * Validate Scenario -> Validate Inputs -> Global Rules -> Defense Rules ->
 * Attack Rules -> Modifiers -> Outcome -> Score -> Explanation ->
 * Event Log. (Recommendation runs once per completed assessment, not per
 * round — see sessionActions.advanceRound.)
 */
export class RuleEngine {
  public async evaluate(input: EvaluateInput): Promise<EvaluateResult> {
    // 1. Validate Scenario
    const scenario = await this.validateScenario(input.scenarioId);

    // 2. Validate Inputs
    this.validateInputs(scenario, input.attackerChoice, input.defenderChoice);

    // 3. Global Rules
    await this.globalRuleChecks(input.sessionId);

    // 4-7. Defense Rules -> Attack Rules -> Modifiers -> Outcome
    const { outcome, explanation } = await this.resolveOutcome(
      scenario.id,
      input.attackerChoice,
      input.defenderChoice
    );

    // 8. Score
    const defenderScoreBreakdown = await scoreEngine.calculateDefenderScore({
      userId: input.defenderId,
      sessionId: input.sessionId,
      category: scenario.category,
      outcome: outcome as any,
      timeTaken: input.defenderTimeTaken,
      isConceptCorrect: outcome === 'defended' || outcome === 'partially_defended',
      choice: input.defenderChoice,
    });

    const attackerScoreBreakdown = await scoreEngine.calculateAttackerScore({
      userId: input.attackerId,
      sessionId: input.sessionId,
      category: scenario.category,
      outcome: outcome as any,
      timeTaken: input.attackerTimeTaken,
      isConceptCorrect: outcome === 'breached' || outcome === 'partially_defended',
      choice: input.attackerChoice,
    });

    // 9. Explanation
    const finalExplanation = this.generateExplanation(outcome as Outcome, explanation);

    // 10. Event Log
    const turnId = (await prisma.event.count({ where: { sessionId: input.sessionId } })) + 1;
    await EventLogger.logEvent({
      turnId,
      sessionId: input.sessionId,
      scenarioId: scenario.id,
      attackerChoice: input.attackerChoice,
      defenderChoice: input.defenderChoice,
      resolvedRule: `${input.attackerChoice}_vs_${input.defenderChoice}`,
      outcome: outcome as Outcome,
      score: defenderScoreBreakdown.total,
      timeTaken: input.defenderTimeTaken,
      timestamp: new Date().toISOString(),
    });

    // Attempts — persisted for both roles so consistency/repeated-mistake
    // tracking works symmetrically.
    await prisma.attempt.create({
      data: {
        sessionId: input.sessionId,
        scenarioId: scenario.id,
        userId: input.defenderId,
        role: 'defender',
        choice: input.defenderChoice,
        outcome,
        score: defenderScoreBreakdown.total,
        timeTaken: input.defenderTimeTaken,
        explanation: finalExplanation,
      },
    });
    await prisma.attempt.create({
      data: {
        sessionId: input.sessionId,
        scenarioId: scenario.id,
        userId: input.attackerId,
        role: 'attacker',
        choice: input.attackerChoice,
        outcome,
        score: attackerScoreBreakdown.total,
        timeTaken: input.attackerTimeTaken,
        explanation: finalExplanation,
      },
    });

    // Per-round Score rows — makes real score history available instead of
    // only the two running Session totals.
    await prisma.score.create({
      data: {
        userId: input.defenderId,
        sessionId: input.sessionId,
        role: 'defender',
        roundNumber: turnId,
        totalScore: defenderScoreBreakdown.total,
        correctChoice: defenderScoreBreakdown.correctChoice,
        timeEfficiency: defenderScoreBreakdown.timeEfficiency,
        consistency: defenderScoreBreakdown.consistency,
        repeatedMistakes: defenderScoreBreakdown.repeatedMistakes,
      },
    });
    await prisma.score.create({
      data: {
        userId: input.attackerId,
        sessionId: input.sessionId,
        role: 'attacker',
        roundNumber: turnId,
        totalScore: attackerScoreBreakdown.total,
        correctChoice: attackerScoreBreakdown.correctChoice,
        timeEfficiency: attackerScoreBreakdown.timeEfficiency,
        consistency: attackerScoreBreakdown.consistency,
        repeatedMistakes: attackerScoreBreakdown.repeatedMistakes,
      },
    });

    // 11. Analytics — single source of truth (AnalyticsEngine), for both users.
    await AnalyticsEngine.updateAnalytics(input.defenderId, scenario.category, outcome === 'defended', input.defenderTimeTaken);
    await AnalyticsEngine.updateAnalytics(input.attackerId, scenario.category, outcome === 'breached', input.attackerTimeTaken);

    return {
      sessionId: input.sessionId,
      scenarioId: scenario.id,
      turnId,
      outcome: outcome as Outcome,
      explanation: finalExplanation,
      attackerScoreBreakdown,
      defenderScoreBreakdown,
    };
  }

  private async validateScenario(scenarioId: string) {
    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }
    return scenario;
  }

  private validateInputs(
    scenario: { attackOptions: unknown; defenseOptions: unknown },
    attackerChoice: string,
    defenderChoice: string
  ) {
    const attackOptions = (scenario.attackOptions as any[]) ?? [];
    const defenseOptions = (scenario.defenseOptions as any[]) ?? [];
    if (!attackOptions.some((o) => o.id === attackerChoice)) {
      throw new Error(`Invalid attack choice: ${attackerChoice}`);
    }
    if (!defenseOptions.some((o) => o.id === defenderChoice)) {
      throw new Error(`Invalid defense choice: ${defenderChoice}`);
    }
  }

  private async globalRuleChecks(sessionId: string) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (session.status === 'ASSESSMENT_COMPLETE') {
      throw new Error('Session is already complete');
    }
  }

  /**
   * Defense Rules -> Attack Rules -> Modifiers -> Outcome. The scenario's
   * seeded Rule rows already encode the defense/attack pairing and its
   * outcome.
   */
  private async resolveOutcome(scenarioId: string, attackerChoice: string, defenderChoice: string) {
    const rule = await prisma.rule.findFirst({
      where: {
        scenarioId,
        attackType: attackerChoice,
        defenseType: defenderChoice,
      },
    });

    if (rule) {
      return {
        outcome: rule.outcome,
        explanation: rule.explanation,
      };
    }

    return {
      outcome: 'breached',
      explanation: 'No specific countermeasure was found for this combination — the defense provided no protection against this attack.',
    };
  }

  private generateExplanation(outcome: Outcome, baseExplanation: string): string {
    if (outcome === Outcome.DEFENDED) {
      return `Successfully defended. ${baseExplanation}`;
    } else if (outcome === Outcome.PARTIALLY_DEFENDED) {
      return `Partially defended. ${baseExplanation}`;
    } else {
      return `Breach occurred. ${baseExplanation}`;
    }
  }
}

export const ruleEngine = new RuleEngine();
