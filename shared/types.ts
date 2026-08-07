// ============================================================
// CyberLearn – Shared Type Definitions
//
// Only the types actually shared across the live backend modules
// (ruleEngine.ts, eventLogger.ts) live here. Anything else was
// speculative scaffolding for a protocol the running app doesn't use.
// ============================================================

export enum Outcome {
  DEFENDED = 'defended',
  PARTIALLY_DEFENDED = 'partially_defended',
  BREACHED = 'breached',
}

export interface ScoreBreakdown {
  correctConceptUsage: number;
  correctDefense: number;
  timeEfficiency: number;
  consistency: number;
  repeatedMistakes: number;
  total: number;
}

export interface EvaluationResult {
  sessionId: string;
  scenarioId: string;
  turnId: number;
  attackerChoice: string;
  defenderChoice: string;
  outcome: Outcome;
  explanation: string;
  scoreBreakdown: ScoreBreakdown;
  attackerTotalScore: number;
  defenderTotalScore: number;
}
