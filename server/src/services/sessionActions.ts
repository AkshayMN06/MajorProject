import { Prisma, PrismaClient, Scenario, Session } from '@prisma/client';
import { ruleEngine } from './ruleEngine';
import { RecommendationEngine } from './recommendationEngine';
import { AnalyticsEngine } from './analyticsEngine';
import { transition, transitionThrough, SessionState } from './stateMachine';

const prisma = new PrismaClient();

type Option = {
  id: string;
  name: string;
  description: string;
  category?: string;
  difficulty?: string;
};
type RoundScenario = Omit<Scenario, 'attackOptions' | 'defenseOptions'> & {
  attackOptions: Option[];
  defenseOptions: Option[];
};

interface RoomState {
  currentScenario: RoundScenario;
  attackStartTime: number;
  attack?: Option;
  defenseStartTime?: number;
  result?: Awaited<ReturnType<typeof scoreRound>>['result'];
}

export function getRoomState(value: Prisma.JsonValue | null): RoomState | null {
  if (!value || typeof value !== 'object' || !('currentScenario' in value)) return null;
  return value as unknown as RoomState;
}

function encodeRoom(room: RoomState): Prisma.InputJsonValue {
  return room as unknown as Prisma.InputJsonValue;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickSystemOption(options: Option[]): Option {
  const option = options[Math.floor(Math.random() * options.length)];
  if (!option) throw new Error('No system option available for this round');
  return option;
}

function phaseGuard(session: Session) {
  return { id: session.id, status: session.status, currentScenarioIndex: session.currentScenarioIndex };
}

function assertParticipant(session: Session, userId: string) {
  if (session.attackerId !== userId && session.defenderId !== userId) {
    throw new Error('You are not a participant in this session');
  }
}

function describeAttack(attack: Option) {
  return {
    attackOptionId: attack.id,
    attackOptionName: attack.name,
    attackOptionDescription: attack.description,
    attackCategory: attack.category,
    attackDifficulty: attack.difficulty,
  };
}

async function prepareRoom(session: Session, index: number): Promise<RoomState> {
  const scenarioIds: string[] = (session.scenarioIds as string[] | null) ?? [];
  const scenario = scenarioIds[index]
    ? await prisma.scenario.findUnique({ where: { id: scenarioIds[index] } })
    : (await prisma.scenario.findMany({ orderBy: { id: 'asc' }, skip: index, take: 1 }))[0];
  if (!scenario) throw new Error('No scenario available for this round');

  return {
    currentScenario: {
      ...scenario,
      attackOptions: shuffle((scenario.attackOptions as unknown as Option[]) ?? []),
      defenseOptions: shuffle((scenario.defenseOptions as unknown as Option[]) ?? []),
    },
    attackStartTime: Date.now(),
  };
}

async function openRound(session: Session, index: number) {
  const initialStatus = index === session.currentScenarioIndex
    ? session.status
    : transition(session.status, SessionState.NEXT_ROUND);
  let status = transitionThrough(initialStatus, [SessionState.SCENARIO_LOADED, SessionState.ATTACK_SELECTION]);
  const room = await prepareRoom(session, index);
  let systemAttack = null;

  if (session.mode === 'SOLO' && session.soloRole === 'DEFENDER') {
    room.attack = pickSystemOption(room.currentScenario.attackOptions);
    room.defenseStartTime = Date.now();
    status = transition(status, SessionState.DEFENSE_SELECTION);
    systemAttack = describeAttack(room.attack);
  }

  const updated = await prisma.session.updateMany({
    where: phaseGuard(session),
    data: { status, currentScenarioIndex: index, roundState: encodeRoom(room) },
  });
  if (!updated.count) return null;

  return {
    sessionId: session.id,
    scenario: room.currentScenario,
    roundNumber: index + 1,
    totalRounds: session.totalScenarios,
    status,
    systemAttack,
  };
}

export async function loadNextScenario(sessionId: string, session: Session) {
  if (session.id !== sessionId) throw new Error('Session not found');
  const round = await openRound(session, session.currentScenarioIndex);
  if (!round) throw new Error('Session changed while loading the round');
  return round;
}

export async function markReady(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  assertParticipant(session, userId);

  const data = session.mode === 'SOLO'
    ? { attackerReady: true, defenderReady: true }
    : session.attackerId === userId ? { attackerReady: true } : { defenderReady: true };
  // Limit the write to waiting/ready states while allowing a join racing readiness.
  await prisma.session.updateMany({
    where: { id: sessionId, status: { in: [SessionState.WAITING_FOR_PARTICIPANT, SessionState.SESSION_READY] } },
    data,
  });
  const updated = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
  const startedRound = updated.status === SessionState.SESSION_READY && updated.attackerReady && updated.defenderReady
    ? await openRound(updated, updated.currentScenarioIndex)
    : null;

  return { attackerReady: updated.attackerReady, defenderReady: updated.defenderReady, startedRound };
}

export async function submitAttack(sessionId: string, userId: string, attackOptionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.attackerId !== userId) throw new Error('Only the attacker can submit an attack');
  if (session.status !== SessionState.ATTACK_SELECTION) throw new Error('Not in attack selection phase');

  // Sessions already in attack selection at upgrade have no persisted options.
  const room = getRoomState(session.roundState) ?? await prepareRoom(session, session.currentScenarioIndex);
  const attack = room.currentScenario.attackOptions.find((option) => option.id === attackOptionId);
  if (!attack) throw new Error('Invalid attack option');

  room.attack = attack;
  room.defenseStartTime = Date.now();
  const status = transition(session.status, SessionState.DEFENSE_SELECTION);
  const description = { sessionId, ...describeAttack(attack), status };

  if (session.mode === 'SOLO' && session.soloRole === 'ATTACKER' && session.defenderId) {
    const defense = pickSystemOption(room.currentScenario.defenseOptions);
    const roundResult = await resolveRound(session, room, defense, status);
    return { ...description, roundResult };
  }

  const updated = await prisma.session.updateMany({
    where: phaseGuard(session),
    data: { status, roundState: encodeRoom(room) },
  });
  if (!updated.count) throw new Error('Round changed while submitting the attack');
  return description;
}

async function scoreRound(db: Prisma.TransactionClient, session: Session, room: RoomState, defense: Option) {
  const { attack, currentScenario, attackStartTime, defenseStartTime } = room;
  if (!attack || defenseStartTime === undefined || !session.defenderId) {
    throw new Error('No attack to defend against');
  }
  const roundNumber = session.currentScenarioIndex + 1;
  const evaluation = await ruleEngine.evaluate({
    sessionId: session.id,
    scenarioId: currentScenario.id,
    attackerId: session.attackerId,
    defenderId: session.defenderId,
    attackerChoice: attack.id,
    defenderChoice: defense.id,
    attackerTimeTaken: Math.max(0, Math.floor((defenseStartTime - attackStartTime) / 1000)),
    defenderTimeTaken: Math.max(0, Math.floor((Date.now() - defenseStartTime) / 1000)),
    turnId: roundNumber,
    attackerIsSystem: session.mode === 'SOLO' && session.soloRole === 'DEFENDER',
    defenderIsSystem: session.mode === 'SOLO' && session.soloRole === 'ATTACKER',
  }, db);

  const attackerTotalScore = session.attackerScore + evaluation.attackerScoreBreakdown.total;
  const defenderTotalScore = session.defenderScore + evaluation.defenderScoreBreakdown.total;
  const result = {
    sessionId: session.id,
    roundNumber,
    totalRounds: session.totalScenarios,
    scenarioName: currentScenario.name,
    attackOptionId: attack.id,
    attackOptionName: attack.name,
    attackOptionDescription: attack.description,
    defenseOptionId: defense.id,
    defenseOptionName: defense.name,
    defenseOptionDescription: defense.description,
    outcome: evaluation.outcome,
    explanation: evaluation.explanation,
    attackerRoundScore: evaluation.attackerScoreBreakdown.total,
    defenderRoundScore: evaluation.defenderScoreBreakdown.total,
    attackerTotalScore,
    defenderTotalScore,
    attackerScoreBreakdown: evaluation.attackerScoreBreakdown,
    defenderScoreBreakdown: evaluation.defenderScoreBreakdown,
    status: SessionState.RESULT_GENERATED,
  };
  return { result, attackerTotalScore, defenderTotalScore };
}

function resolveRound(session: Session, room: RoomState, defense: Option, defenseStatus: string) {
  const processingStatus = transition(defenseStatus, SessionState.RULE_PROCESSING);
  const resultStatus = transition(processingStatus, SessionState.RESULT_GENERATED);
  return prisma.$transaction(async (db) => {
    // First statement is a guarded write: it row-locks this session until the
    // transaction ends, so a competing defense waits and then fails the guard.
    // If any later write fails, the original phase and all round data roll back.
    const claimed = await db.session.updateMany({
      where: phaseGuard(session),
      data: { status: processingStatus },
    });
    if (!claimed.count) throw new Error('Round changed while submitting the defense');

    const { result, attackerTotalScore, defenderTotalScore } = await scoreRound(db, session, room, defense);
    await db.session.update({
      where: { id: session.id },
      data: {
        status: resultStatus,
        roundState: encodeRoom({ ...room, result }),
        attackerScore: attackerTotalScore,
        defenderScore: defenderTotalScore,
      },
    });
    return result;
  });
}

export async function submitDefense(sessionId: string, userId: string, defenseOptionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.defenderId !== userId) throw new Error('Only the defender can submit a defense');
  if (session.status !== SessionState.DEFENSE_SELECTION) throw new Error('Not in defense selection phase');

  const room = getRoomState(session.roundState);
  if (!room?.attack) throw new Error('No attack to defend against');
  const defense = room.currentScenario.defenseOptions.find((option) => option.id === defenseOptionId);
  if (!defense) throw new Error('Invalid defense option');
  return resolveRound(session, room, defense, session.status);
}

export async function finalizeCompletedAssessment(session: Session) {
  if (session.status !== SessionState.ASSESSMENT_COMPLETE || session.completionArtifactsAt) return;
  try {
    await prisma.$transaction(async (db) => {
      const claimed = await db.session.updateMany({
        where: { id: session.id, status: SessionState.ASSESSMENT_COMPLETE, completionArtifactsAt: null },
        data: { completionArtifactsAt: new Date() },
      });
      if (!claimed.count) return;

      await AnalyticsEngine.recordAssessmentCompletion(session.id, db);
      await RecommendationEngine.generateRecommendations(session.attackerId, db);
      if (session.defenderId && session.defenderId !== session.attackerId) {
        await RecommendationEngine.generateRecommendations(session.defenderId, db);
      }
    });
  } catch (error) {
    console.error('Assessment artifacts could not be saved and will be retried on reconnect', { sessionId: session.id, error });
  }
}

export async function advanceRound(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  assertParticipant(session, userId);

  if (session.status === SessionState.ASSESSMENT_COMPLETE) {
    await finalizeCompletedAssessment(session);
    return { complete: true as const, sessionId };
  }

  // The old two-step advance could leave NEXT_ROUND stored before loading it.
  const nextIndex = session.currentScenarioIndex + (session.status === SessionState.NEXT_ROUND ? 0 : 1);
  if (nextIndex >= session.totalScenarios) {
    const status = transitionThrough(session.status, [SessionState.NEXT_ROUND, SessionState.ASSESSMENT_COMPLETE]);
    const completedAt = new Date();
    const changed = await prisma.session.updateMany({
      where: phaseGuard(session),
      data: { status, completedAt, roundState: Prisma.DbNull },
    });
    if (changed.count) await finalizeCompletedAssessment({ ...session, status, completedAt });
    return { complete: true as const, sessionId };
  }

  const startedRound = await openRound(session, nextIndex);
  if (!startedRound) throw new Error('Round has already advanced');
  return { complete: false as const, startedRound };
}
